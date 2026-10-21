// End-to-end check of selectable characters: two/three browsers pick different characters
// and must see each other re-skin, the choice must apply to the LOCAL avatar, and a
// late-joiner must receive it on join. Runs the REAL game + REAL presence server.
import { chromium } from 'playwright-core';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const execPath = readFileSync('/tmp/ibc-chromium-path', 'utf8').trim();

process.env.PRESENCE_PORT = '8162';
await import('../server/presence-server.mjs');
const WS_URL = 'ws://127.0.0.1:8162';

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
const seesCharacter = (page, id, charId) => page.waitForFunction(
    ([rid, c]) => window.__ibcPresence?.remotes?.characterFor(rid) === c, [id, charId], { timeout: 10000 });
// Texture key the local player's grid-engine sprite is currently using.
const localTexture = (page) => page.evaluate(() => {
    const s = window.__isotopia.game.scene.getScene('library');
    return s.gridEngine.getSprite(s.playerName)?.texture?.key || null;
});

const alice = await boot('Alice');
const bob = await boot('Bob');
console.log(`Alice=${alice.id}  Bob=${bob.id}`);
const steps = [];

try { await seesRemote(bob.page, alice.id); await seesRemote(alice.page, bob.id); }
catch { await fail('members never saw each other'); }
steps.push('Alice & Bob both in the Library');

// 2) Alice picks a specific pixel villager; Bob should see the re-skin, and Alice's OWN
// avatar sprite should switch to that character's texture.
await alice.page.evaluate(() => window.__ibcPresence.setCharacter('tf3'));
try { await seesCharacter(bob.page, alice.id, 'tf3'); }
catch {
    const seen = await bob.page.evaluate(r => window.__ibcPresence.remotes.characterFor(r), alice.id).catch(() => null);
    await fail("Bob never saw Alice switch to villager tf3", { seen });
}
steps.push("Bob sees Alice switch to villager (tf3)");
const aliceTex = await localTexture(alice.page);
if (aliceTex !== 'ibc_tf_3') await fail("Alice's own avatar did not swap to the chosen character", { aliceTex, want: 'ibc_tf_3' });
steps.push(`Alice's own avatar swapped (texture ${aliceTex})`);

// 3) Bob switches to an animal (different sheet/frame size); Alice should see it, and
// Bob's own avatar should swap to the animal texture.
await bob.page.evaluate(() => window.__ibcPresence.setCharacter('cat_gray'));
try { await seesCharacter(alice.page, bob.id, 'cat_gray'); }
catch { await fail("Alice never saw Bob switch to the gray cat"); }
const bobTex = await localTexture(bob.page);
if (bobTex !== 'ibc_cat_gray') await fail("Bob's own avatar did not swap to the animal", { bobTex, want: 'ibc_cat_gray' });
steps.push(`Alice sees Bob become the gray cat; Bob's avatar swapped (${bobTex})`);

// 3b) Bob switches to the dog (cross-type swap pixel->drawn); Alice should see it.
await bob.page.evaluate(() => window.__ibcPresence.setCharacter('perli'));
try { await seesCharacter(alice.page, bob.id, 'perli'); }
catch { await fail("Alice never saw Bob switch to the dog"); }
steps.push('Alice sees Bob switch to the dog (perli)');

// 3c) Bob switches to a 3-direction critter (mirrored for right); Alice should see it,
// and Bob's own avatar swaps to the critter texture.
await bob.page.evaluate(() => window.__ibcPresence.setCharacter('hamster'));
try { await seesCharacter(alice.page, bob.id, 'hamster'); }
catch { await fail("Alice never saw Bob become the hamster"); }
if (await localTexture(bob.page) !== 'ibc_hamster') await fail("Bob's avatar did not swap to the hamster");
steps.push("Alice sees Bob become the hamster; Bob's avatar swapped");

// The hamster is a 3-direction creature: it mirrors (flipX) when facing right.
const mirror = await bob.page.evaluate(async () => {
    const s = window.__isotopia.game.scene.getScene('library');
    const flip = () => s.gridEngine.getSprite(s.playerName).flipX;
    const wait = () => new Promise(r => setTimeout(r, 120));
    s.gridEngine.turnTowards(s.playerName, 'right'); await wait(); const right = flip();
    s.gridEngine.turnTowards(s.playerName, 'left'); await wait(); const left = flip();
    return { right, left };
});
if (mirror.right !== true || mirror.left !== false) await fail('hamster did not mirror for right-facing', mirror);
steps.push('hamster mirrors for right-facing (flipX right=true, left=false)');

// 4) Late-joiner gets Alice's chosen character on join (snapshot).
const carol = await boot('Carol');
try { await seesCharacter(carol.page, alice.id, 'tf3'); }
catch { await fail("late-joiner Carol did not receive Alice's character on join"); }
steps.push("late-joiner Carol sees Alice's character on join");

await browser.close();
console.log('PASS:');
steps.forEach(s => console.log('  - ' + s));
process.exit(0);
