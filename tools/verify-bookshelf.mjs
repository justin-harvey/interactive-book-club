// Headless end-to-end check of the M2 bookshelf → reader flow against the REAL
// game. Boots dist with ?e2e (exposes window.__isotopia), enters the Library,
// walks the player onto the welcome book's shelf pad, and asserts the in-world
// reader opens showing welcome.pdf. Serve dist on :8123 before running.
import { chromium } from 'playwright-core';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const execPath = readFileSync('/tmp/ibc-chromium-path', 'utf8').trim();

// Self-contained static server for dist/ (avoids flaky background servers).
const ROOT = new URL('../dist/', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png',
    '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const URL_ = `http://127.0.0.1:${PORT}/?e2e`;
console.log(`serving dist on :${PORT}`);

const browser = await chromium.launch({ executablePath: execPath });
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto(URL_, { waitUntil: 'load' });

// 1) Wait for the e2e hook + the game instance.
await page.waitForFunction(() => (window).__isotopia?.game, null, { timeout: 15000 });

// 2) Enter the Library scene and wait for the player to be registered.
const entered = await page.evaluate(async () => {
    const { game } = (window).__isotopia;
    game.scene.start('library');
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 100; i++) {
        const s = game.scene.getScene('library');
        if (s && s.sys.isActive() && s.gridEngine?.hasCharacter(s.playerName)) {
            return { ok: true, player: s.playerName, pos: s.gridEngine.getPosition(s.playerName) };
        }
        await sleep(100);
    }
    return { ok: false };
});
if (!entered.ok) { console.error('FAIL: never entered Library / player not ready'); await browser.close(); process.exit(1); }
console.log(`entered Library as "${entered.player}" at (${entered.pos.x},${entered.pos.y})`);

// 3) Walk onto the welcome book's pad (6,8) and let movementStopped fire.
await page.evaluate(async () => {
    const { game } = (window).__isotopia;
    const s = game.scene.getScene('library');
    s.gridEngine.moveTo(s.playerName, { x: 6, y: 8 });
});

const steps = [];
const fail = async (msg, extra) => {
    console.error(`FAIL: ${msg}`);
    if (extra) console.error(JSON.stringify(extra, null, 2));
    if (errors.length) console.error('console errors:', errors.slice(0, 5));
    await browser.close();
    process.exit(1);
};
// Wait for the canvas reader to show a given "page / total" string.
const waitForPage = (want) => page.waitForFunction(
    (w) => {
        const el = document.getElementById('book-reader');
        const pg = document.querySelector('.book-reader__page');
        return el && getComputedStyle(el).display !== 'none' && pg && pg.textContent.trim() === w;
    }, want, { timeout: 15000 });

// 4) Reader opens on page 1 of 6 (welcome.pdf has 6 pages).
try { await waitForPage('1 / 6'); } catch (e) {
    await fail('reader did not open on page 1 / 6', await page.evaluate(() => ({
        display: document.getElementById('book-reader') && getComputedStyle(document.getElementById('book-reader')).display,
        page: document.querySelector('.book-reader__page')?.textContent,
        title: document.querySelector('.book-reader__title')?.textContent,
    })).catch(() => ({})));
}
const title = await page.evaluate(() => document.querySelector('.book-reader__title')?.textContent);
steps.push(`opened "${title}" at page 1 / 6`);

// 5) Page forward to page 3 (ArrowRight twice).
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowRight');
try { await waitForPage('3 / 6'); } catch { await fail('paging forward did not reach 3 / 6'); }
steps.push('paged forward to 3 / 6');

// 6) Close (Escape) — page should persist to localStorage.
await page.keyboard.press('Escape');
await page.waitForFunction(() => {
    const el = document.getElementById('book-reader');
    return !el || getComputedStyle(el).display === 'none';
}, null, { timeout: 5000 }).catch(() => {});
const stored = await page.evaluate(() => localStorage.getItem('ibc:page:welcome'));
if (stored !== '3') await fail(`expected saved page 3, got ${stored}`);
steps.push(`closed; localStorage ibc:page:welcome = ${stored}`);

// 7) RESUME: walk off the pad and back; reader should reopen at page 3 / 6.
// Wait for the step-away to actually ARRIVE before walking back — issuing the return
// moveTo while the first is still in flight retargets grid-engine mid-move and can stall
// the avatar one tile short (a known grid-engine quirk; see docs/HANDOFF.md verify:presence
// note). A fixed sleep is racy under varying scene weight; poll the tile instead.
await page.evaluate(async () => {
    const s = (window).__isotopia.game.scene.getScene('library');
    s.gridEngine.moveTo(s.playerName, { x: 8, y: 10 });   // step away
});
try {
    await page.waitForFunction(() => {
        const s = (window).__isotopia.game.scene.getScene('library');
        const p = s.gridEngine.getPosition(s.playerName);
        return p.x === 8 && p.y === 10;
    }, null, { timeout: 10000 });
} catch { await fail('player never reached the step-away tile (8,10)'); }
await page.evaluate(async () => {
    const s = (window).__isotopia.game.scene.getScene('library');
    s.gridEngine.moveTo(s.playerName, { x: 6, y: 8 });     // back onto the pad
});
try { await waitForPage('3 / 6'); } catch { await fail('did not RESUME at page 3 / 6 on reopen'); }
steps.push('reopened and RESUMED at 3 / 6');

await browser.close();
console.log('PASS:');
steps.forEach(s => console.log('  - ' + s));
if (errors.length) console.log(`(note: ${errors.length} console error(s), e.g. ${errors[0]})`);
process.exit(0);
