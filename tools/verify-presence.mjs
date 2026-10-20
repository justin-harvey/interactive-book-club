// Two-browser end-to-end check of M4 real-time presence against the REAL game and the
// REAL self-hosted presence server (started in-process here). Two independent browser
// contexts (Alice, Bob) each boot dist with ?e2e, enter the Library, and we assert:
//   1. each sees the other's avatar appear,
//   2. when Alice walks, Bob sees her avatar move to the new tile,
//   3. when Alice's tab closes, Bob sees her avatar removed.
import { chromium } from 'playwright-core';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const execPath = readFileSync('/tmp/ibc-chromium-path', 'utf8').trim();

// Start the presence server in this process on a fixed test port.
process.env.PRESENCE_PORT = '8147';
await import('../server/presence-server.mjs');
const WS_URL = 'ws://127.0.0.1:8147';

// Static server for dist/.
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

// Boot one member: own context (separate localStorage), set presence URL + name, enter Library.
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

const alice = await boot('Alice');
const bob = await boot('Bob');
console.log(`Alice=${alice.id}  Bob=${bob.id}`);
const steps = [];

// 1) Mutual visibility.
try { await seesRemote(bob.page, alice.id); } catch { await fail('Bob never saw Alice'); }
try { await seesRemote(alice.page, bob.id); } catch { await fail('Alice never saw Bob'); }
steps.push('both members see each other in the Library');

// 2) Alice walks to (6,8); Bob should see her avatar arrive there.
await alice.page.evaluate(() => {
    const s = window.__isotopia.game.scene.getScene('library');
    s.gridEngine.moveTo(s.playerName, { x: 6, y: 8 });
});
try {
    await bob.page.waitForFunction((rid) => {
        const s = window.__isotopia.game.scene.getScene('library');
        if (!s.gridEngine.hasCharacter('remote:' + rid)) return false;
        const p = s.gridEngine.getPosition('remote:' + rid);
        return p.x === 6 && p.y === 8;
    }, alice.id, { timeout: 10000 });
} catch {
    const where = await bob.page.evaluate((rid) => {
        const s = window.__isotopia.game.scene.getScene('library');
        return s.gridEngine.hasCharacter('remote:' + rid) ? s.gridEngine.getPosition('remote:' + rid) : null;
    }, alice.id).catch(() => null);
    await fail('Bob did not see Alice move to (6,8)', { aliceRemotePos: where });
}
steps.push("Bob sees Alice's avatar walk to (6,8)");

// 3) Alice leaves; Bob should drop her avatar.
await alice.ctx.close();
try {
    await bob.page.waitForFunction((rid) => {
        const s = window.__isotopia.game.scene.getScene('library');
        return !s.gridEngine.hasCharacter('remote:' + rid);
    }, alice.id, { timeout: 10000 });
} catch { await fail('Bob still saw Alice after she left'); }
steps.push('Bob sees Alice removed after she disconnects');

await browser.close();
console.log('PASS:');
steps.forEach(s => console.log('  - ' + s));
process.exit(0);
