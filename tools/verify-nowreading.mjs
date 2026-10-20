// Two/three-browser end-to-end check of M5 "Now Reading" against the REAL game and the
// REAL self-hosted presence server (started in-process). We assert the SHARED club pick:
//   1. Alice & Bob are both in the Library,
//   2. Alice sets the pick; Bob sees it sync,
//   3. Alice sees her own pick (server echo, not just optimistic),
//   4. a late-joiner (Carol) receives the current pick on join,
//   5. the server persisted it to now-reading.json.
import { chromium } from 'playwright-core';
import { readFileSync, existsSync, statSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const execPath = readFileSync('/tmp/ibc-chromium-path', 'utf8').trim();

// Start from a clean slate so the preloaded pick is deterministic.
const STATE_FILE = new URL('../server/now-reading.json', import.meta.url);
try { rmSync(STATE_FILE); } catch { /* none */ }

process.env.PRESENCE_PORT = '8150';
await import('../server/presence-server.mjs');
const WS_URL = 'ws://127.0.0.1:8150';

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

const seesPick = (page, bookId) => page.waitForFunction(
    (id) => window.__ibcPresence?.nowReading() === id, bookId, { timeout: 10000 });

const alice = await boot('Alice');
const bob = await boot('Bob');
console.log(`Alice=${alice.id}  Bob=${bob.id}`);
const steps = [];

try { await seesRemote(bob.page, alice.id); await seesRemote(alice.page, bob.id); }
catch { await fail('members never saw each other'); }
steps.push('Alice & Bob both in the Library');

// 2) Alice sets the pick; Bob should see it sync.
const PICK = 'field-notes';
await alice.page.evaluate((id) => window.__ibcPresence.setReading(id), PICK);
try { await seesPick(bob.page, PICK); }
catch { await fail("Bob never saw Alice's Now Reading pick"); }
steps.push(`Bob sees the club pick sync to "${PICK}"`);

// 3) Alice sees the pick confirmed (server echoed it back, not only optimistic).
try { await seesPick(alice.page, PICK); }
catch { await fail('Alice never got the server echo of her own pick'); }
steps.push('Alice sees the pick confirmed by the server');

// 4) A late-joiner receives the current pick on join.
const carol = await boot('Carol');
try { await seesPick(carol.page, PICK); }
catch { await fail('late-joiner Carol did not receive the current pick on join'); }
steps.push('late-joiner Carol receives the pick on join');

// 5) Server persisted it.
let persisted = null;
try { persisted = JSON.parse(readFileSync(STATE_FILE, 'utf8')).bookId; } catch { /* missing */ }
if (persisted !== PICK) await fail('pick was not persisted to now-reading.json', { persisted });
steps.push('pick persisted to now-reading.json');

await browser.close();
try { rmSync(STATE_FILE); } catch { /* ignore */ }
console.log('PASS:');
steps.forEach(s => console.log('  - ' + s));
process.exit(0);
