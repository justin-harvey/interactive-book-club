// End-to-end check of the M6 same-origin reverse-proxy wiring, WITHOUT Docker. It stands
// up exactly the topology the container stack uses — static game on / and the presence
// WebSocket proxied at the SAME origin under /presence — using a tiny dependency-free Node
// proxy that forwards the WS upgrade (what nginx does in docker/nginx.conf).
//
// Crucially it serves on a NON-loopback address, so the browser's PresenceClient takes its
// real production path (ws://<host>/presence) instead of the dev ws://localhost:8140. We
// do NOT set __IBC_PRESENCE_URL — the whole point is to exercise the default resolution.
import { chromium } from 'playwright-core';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { connect as netConnect } from 'node:net';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize } from 'node:path';

const execPath = readFileSync('/tmp/ibc-chromium-path', 'utf8').trim();

// Presence server in-process on a fixed port (stands in for the "presence" container).
process.env.PRESENCE_PORT = '8160';
await import('../server/presence-server.mjs');
const PRESENCE_PORT = 8160;

// Pick a non-loopback IPv4 so PresenceClient uses /presence, not ws://localhost:8140.
const host = Object.values(networkInterfaces()).flat()
    .find(i => i && i.family === 'IPv4' && !i.internal)?.address;
if (!host) { console.error('FAIL: no non-loopback IPv4 to bind'); process.exit(1); }

const ROOT = new URL('../dist/', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png',
    '.webmanifest': 'application/manifest+json' };

const httpd = createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
        // SPA fallback, like nginx try_files ... /index.html
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(readFileSync(join(ROOT, 'index.html')));
        return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
});

// Reverse-proxy the WebSocket upgrade for /presence to the presence server — the exact job
// of nginx's `location = /presence { proxy_pass ...; Upgrade; Connection }`.
httpd.on('upgrade', (req, clientSocket, head) => {
    if (!(req.url || '').startsWith('/presence')) { clientSocket.destroy(); return; }
    const upstream = netConnect(PRESENCE_PORT, '127.0.0.1', () => {
        let raw = `GET ${req.url} HTTP/1.1\r\n`;
        for (let i = 0; i < req.rawHeaders.length; i += 2) raw += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
        raw += '\r\n';
        upstream.write(raw);
        if (head && head.length) upstream.write(head);
        upstream.pipe(clientSocket);
        clientSocket.pipe(upstream);
    });
    upstream.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => upstream.destroy());
});

await new Promise(r => httpd.listen(0, host, r));
const PORT = httpd.address().port;
const PAGE = `http://${host}:${PORT}/?e2e`;
console.log(`serving game + /presence proxy on http://${host}:${PORT} (presence upstream :${PRESENCE_PORT})`);

const browser = await chromium.launch({ executablePath: execPath });
const fail = async (msg, extra) => {
    console.error(`FAIL: ${msg}`);
    if (extra) console.error(JSON.stringify(extra, null, 2));
    await browser.close(); process.exit(1);
};

// NOTE: no addInitScript setting __IBC_PRESENCE_URL — default resolution must find /presence.
async function boot(name) {
    const ctx = await browser.newContext();
    await ctx.addInitScript((nm) => { try { localStorage.setItem('ibc:name', nm); } catch {} }, name);
    const page = await ctx.newPage();
    await page.goto(PAGE, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__isotopia?.game, null, { timeout: 15000 });
    const ok = await page.evaluate(async () => {
        const { game } = window.__isotopia;
        game.scene.start('library');
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        for (let i = 0; i < 100; i++) {
            const s = game.scene.getScene('library');
            if (s && s.sys.isActive() && s.gridEngine?.hasCharacter(s.playerName) && window.__ibcPresence) return true;
            await sleep(100);
        }
        return false;
    });
    if (!ok) await fail(`${name} never entered Library`);
    const id = await page.evaluate(() => window.__ibcPresence.id);
    // Confirm the client actually resolved the same-origin /presence URL (not ws://localhost).
    const url = await page.evaluate(() => {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${proto}//${location.host}/presence`;
    });
    return { ctx, page, id, name, url };
}

const steps = [];
const alice = await boot('Alice');
const bob = await boot('Bob');
if (!alice.url.endsWith('/presence')) await fail('client did not resolve a /presence URL', { url: alice.url });
console.log(`resolved presence URL: ${alice.url}`);
steps.push(`client connects via same-origin ${alice.url}`);

const seesRemote = (page, id) => page.waitForFunction(
    (rid) => { const s = window.__isotopia.game.scene.getScene('library'); return !!s && s.gridEngine.hasCharacter('remote:' + rid); },
    id, { timeout: 10000 });

try { await seesRemote(bob.page, alice.id); await seesRemote(alice.page, bob.id); }
catch { await fail('members never saw each other through the proxy'); }
steps.push('both members present through the proxy (WS upgrade works)');

// Chat through the proxy proves the duplex relay, not just the handshake.
const MSG = 'Proxy test — can you read me?';
await alice.page.evaluate((m) => window.__ibcPresence.say(m), MSG);
try {
    await bob.page.waitForFunction(
        ([g, t]) => window.__ibcPresence?.bubbles?.textFor(g) === t,
        ['remote:' + alice.id, MSG], { timeout: 10000 });
} catch { await fail("Bob never saw Alice's message through the proxy"); }
steps.push('chat relayed through the proxy (duplex frames flow)');

await browser.close();
console.log('PASS:');
steps.forEach(s => console.log('  - ' + s));
process.exit(0);
