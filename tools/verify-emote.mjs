// Two-browser end-to-end check of M5 emotes against the REAL game and the REAL
// self-hosted presence server (started in-process here). Two independent browser
// contexts (Alice, Bob) each boot dist with ?e2e and enter the Library, then we assert:
//   1. both see each other (presence prerequisite),
//   2. Alice reacts; Bob sees the glyph pop over Alice's avatar,
//   3. Alice sees her OWN glyph (sender echo),
//   4. Bob reacts back with a different glyph; Alice sees it.
import { chromium } from 'playwright-core';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const execPath = readFileSync('/tmp/ibc-chromium-path', 'utf8').trim();

process.env.PRESENCE_PORT = '8149';
await import('../server/presence-server.mjs');
const WS_URL = 'ws://127.0.0.1:8149';

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

// Wait until `page` has registered `glyph` as the latest emote over character `gid`.
const seesEmote = (page, gid, glyph) => page.waitForFunction(
    ([g, e]) => window.__ibcPresence?.emotes?.lastFor(g) === e,
    [gid, glyph], { timeout: 10000 });

const alice = await boot('Alice');
const bob = await boot('Bob');
console.log(`Alice=${alice.id}  Bob=${bob.id}`);
const steps = [];

// 1) Presence prerequisite.
try { await seesRemote(bob.page, alice.id); await seesRemote(alice.page, bob.id); }
catch { await fail('members never saw each other'); }
steps.push('both members present in the Library');

// 2) Alice reacts; Bob sees the glyph over her avatar.
const E1 = '👍';
await alice.page.evaluate((e) => window.__ibcPresence.emote(e), E1);
try { await seesEmote(bob.page, 'remote:' + alice.id, E1); }
catch { await fail("Bob never saw Alice's emote"); }
steps.push("Bob sees Alice's 👍 over her avatar");

// 3) Alice sees her own glyph (sender echo).
const own = await alice.page.evaluate(() => window.__ibcPresence.emotes.lastFor(window.__isotopia.game.scene.getScene('library').playerName));
if (own !== E1) await fail('Alice did not see her own emote', { own });
steps.push('Alice sees her own emote (sender echo)');

// 4) Bob reacts back with a different glyph; Alice sees it.
const E2 = '🎉';
await bob.page.evaluate((e) => window.__ibcPresence.emote(e), E2);
try { await seesEmote(alice.page, 'remote:' + bob.id, E2); }
catch { await fail("Alice never saw Bob's reply emote"); }
steps.push("Alice sees Bob's 🎉 reaction");

await browser.close();
console.log('PASS:');
steps.forEach(s => console.log('  - ' + s));
process.exit(0);
