// Two-browser end-to-end check of M5 in-world chat against the REAL game and the REAL
// self-hosted presence server (started in-process here). Two independent browser
// contexts (Alice, Bob) each boot dist with ?e2e and enter the Library, then we assert:
//   1. both see each other (presence prerequisite),
//   2. Alice sends a chat line; Bob sees it in a bubble over Alice's avatar,
//   3. Alice sees her OWN bubble (speaker echo), and it auto-expires,
//   4. Bob replies; Alice sees Bob's bubble.
import { chromium } from 'playwright-core';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const execPath = readFileSync('/tmp/ibc-chromium-path', 'utf8').trim();

process.env.PRESENCE_PORT = '8148';
await import('../server/presence-server.mjs');
const WS_URL = 'ws://127.0.0.1:8148';

const ROOT = new URL('../dist/', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png',
    '.webmanifest': 'application/manifest+json' };
const httpd = createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
});
await new Promise(r => httpd.listen(0, '127.0.0.1', r));
const PORT = httpd.address().port;
const PAGE = `http://127.0.0.1:${PORT}/?e2e`;
console.log(`serving dist on :${PORT}, presence on ${WS_URL}`);

const browser = await chromium.launch({ executablePath: execPath });

const fail = async (msg, extra) => {
    console.error(`FAIL: ${msg}`);
    if (extra) console.error(JSON.stringify(extra, null, 2));
    await browser.close(); process.exit(1);
};

async function boot(name) {
    const ctx = await browser.newContext();
    await ctx.addInitScript(([url, nm]) => {
        window.__IBC_PRESENCE_URL = url;
        try { localStorage.setItem('ibc:name', nm); } catch {}
    }, [WS_URL, name]);
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
    if (!ok) await fail(`${name} never entered Library with presence`);
    const id = await page.evaluate(() => window.__ibcPresence.id);
    return { ctx, page, id, name };
}

const seesRemote = (page, id) => page.waitForFunction(
    (rid) => { const s = window.__isotopia.game.scene.getScene('library'); return !!s && s.gridEngine.hasCharacter('remote:' + rid); },
    id, { timeout: 10000 });

// Wait until `page` shows `text` in the bubble over character `gid`.
const seesBubble = (page, gid, text) => page.waitForFunction(
    ([g, t]) => window.__ibcPresence?.bubbles?.textFor(g) === t,
    [gid, text], { timeout: 10000 });

const alice = await boot('Alice');
const bob = await boot('Bob');
console.log(`Alice=${alice.id}  Bob=${bob.id}`);
const steps = [];

// 1) Presence prerequisite.
try { await seesRemote(bob.page, alice.id); await seesRemote(alice.page, bob.id); }
catch { await fail('members never saw each other'); }
steps.push('both members present in the Library');

// 2) Alice speaks (via the same sendChat path the composer uses); Bob sees the bubble.
const MSG = 'Hello from Alice!';
await alice.page.evaluate((m) => window.__ibcPresence.say(m), MSG);
try { await seesBubble(bob.page, 'remote:' + alice.id, MSG); }
catch { await fail("Bob never saw Alice's chat bubble"); }
steps.push("Bob sees Alice's chat bubble over her avatar");

// 3) Alice sees her own bubble (speaker echo), then it auto-expires (~5s).
const ownNow = await alice.page.evaluate(() => window.__ibcPresence.bubbles.textFor(window.__isotopia.game.scene.getScene('library').playerName));
if (ownNow !== MSG) await fail('Alice did not see her own bubble', { ownNow });
steps.push("Alice sees her own bubble (speaker echo)");
try {
    await bob.page.waitForFunction(
        (rid) => window.__ibcPresence.bubbles.textFor('remote:' + rid) === null,
        alice.id, { timeout: 8000 });
} catch { await fail("Alice's bubble never expired on Bob's screen"); }
steps.push('bubble auto-expires after its lifetime');

// 4) Bob replies; Alice sees it.
const REPLY = 'Hi Alice, what are we reading?';
await bob.page.evaluate((m) => window.__ibcPresence.say(m), REPLY);
try { await seesBubble(alice.page, 'remote:' + bob.id, REPLY); }
catch { await fail("Alice never saw Bob's reply bubble"); }
steps.push("Alice sees Bob's reply bubble");

await browser.close();
console.log('PASS:');
steps.forEach(s => console.log('  - ' + s));
process.exit(0);
