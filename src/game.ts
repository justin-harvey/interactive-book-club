import { GridEngine } from "grid-engine";

import GlobalInfo from "./GlobalInfo";
import TestScene from "./Scenes/TestScene";
import HomeScene from "./Scenes/HomeScene";
import HardwareScene from "./Scenes/HardwareScene";
import HannafordScene from "./Scenes/HannafordScene";
import AutoScene from "./Scenes/AutoScene";
import LibraryScene from "./Scenes/LibraryScene";
import WoodsScene from "./Scenes/WoodsScene";
import DesertScene from "./Scenes/DesertScene";
import JungleScene from "./Scenes/JungleScene";
import CityScene from "./Scenes/CityScene";
import {
    CityPowerTowerScene, CityFinanceScene, CityLargeTowerScene, CityChurchScene,
    CityFashionScene, CityRadioTowerScene, CityPowerStationScene, CityRadioTower2Scene,
    CityMuseumScene, CityMuseumB1Scene, CityMuseumB2Scene, CityMuseumB3Scene, CityMuseumB4Scene,
    AtlantisScene,
} from "./Scenes/CityInteriors";
import { ensureSignedIn } from "./data/auth";
import { initStudentAuth } from "./data/studentAuth";
import { loadQuestionBank } from "./data/questionSource";
import { loadAndCacheSettings } from "./data/classConfig";
import { loadSeasonId } from "./data/season";
import { maybeResetForSeason } from "./data/progress";
import { initIsotopedex } from "./ui/Isotopedex";
import { initIntro } from "./ui/Intro";
import { mountRadFinder } from "./ui/RadFinder";
import { mountDevWarp } from "./ui/DevWarp";
import { refreshHud } from "./ui/hud";

// BOOKCLUB M1 polish: the lesson UI (Isotopedex "collection" button, the Elemental
// "how to play" intro card + "?" help button, and the Rad Finder) is not mounted in
// the book club. Re-enable by uncommenting. The static book-club HUD in index.html
// stands on its own (we also skip refreshHud() below, which would rewrite it with
// Elemental text).
// initIsotopedex();
// initIntro();
// mountRadFinder();

// Watch for optional student sign-in (guests stay anonymous). When a student
// signs in, their progress syncs to students/{uid}.
initStudentAuth();

// If Firebase is configured: sign the student in anonymously, then pull the live
// question bank + class settings (which elements are released). We start Phaser
// only AFTER this so the first scene already knows the release schedule; on any
// error we fall back to the local seed + "everything released" defaults.
// Never leave students on a blank screen: flaky school Wi-Fi or a stalled
// Firebase call (e.g. auth inside a WebView) just means the game starts on the
// local seed. Anything that arrives late still lands in the caches.
const STARTUP_TIMEOUT_MS = 8000;

(async () => {
    try {
        const online = (async () => {
            const uid = await ensureSignedIn();
            const [, , season] = await Promise.all([
                loadQuestionBank(), loadAndCacheSettings(), loadSeasonId(),
            ]);
            // Guest / local reset: if staff have started a new season, wipe this
            // device's collection once before the first scene loads. Signed-in
            // students get the same treatment against their cloud record in
            // attachStudent (studentAuth → progress), which may run slightly later.
            if (maybeResetForSeason(season)) {
                console.log(`Isotopia: new season "${season}" — collection reset for a fresh start.`);
            }
            return uid;
        })();
        const timedOut = new Promise<'timeout'>(resolve =>
            setTimeout(() => resolve('timeout'), STARTUP_TIMEOUT_MS));
        const uid = await Promise.race([online, timedOut]);
        if (uid === 'timeout') {
            online.catch(() => undefined);      // settles later; nothing to report
            console.warn(`Isotopia: Firebase didn't answer in ${STARTUP_TIMEOUT_MS / 1000}s — starting with local questions.`);
        } else {
            console.log(uid
                ? `Isotopia: signed in (${uid.slice(0, 6)}…), questions + settings loaded from Firebase.`
                : "Isotopia: Firebase not configured — using local questions.");
        }
    } catch (err) {
        console.warn("Isotopia: using local questions (Firebase unavailable):", err);
    } finally {
        // BOOKCLUB M1 polish: skip refreshHud() (it rewrites the HUD tip with Elemental
        // lesson text) — the static book-club HUD in index.html stays as written.
        // refreshHud();
        const game = new Phaser.Game(config);
        // Debug hook (opt-in via ?e2e / ?debug) so automated tests can drive the
        // game; not exposed in normal play.
        if (/[?&](e2e|debug)\b/.test(location.search)) (window as any).__isotopia = { game, GlobalInfo };
        // BOOKCLUB M1 polish: staff/dev lesson warp overlay not mounted.
        // mountDevWarp(game);
        installFormKeyboardGuard(game);
        if (game.isRunning) fitGameToScreen(game);
        else game.events.once(Phaser.Core.Events.READY, () => fitGameToScreen(game));
    }
})();

// Shape the game to the screen. The short side stays GAME_SHORT_SIDE game pixels
// (so every scene's zoom shows the same amount of world), and the long side
// stretches to match the screen: a portrait iPad gets a tall view of the world
// instead of a 4:3 box between black bars, and a landscape iPad fills its width.
// Extreme shapes are capped so a phone doesn't see an absurd strip of the map.
// Re-runs on rotation / window resize; Phaser resizes each camera's viewport
// automatically and the per-scene camera zoom stays fixed.
const GAME_SHORT_SIDE = 600;
const MAX_ASPECT = 16 / 9;

function fitGameToScreen(game: Phaser.Game): void {
    const parent = document.getElementById('phaser-game');
    if (!parent) return;
    const fit = (): void => {
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        if (!w || !h) return;
        const aspect = Math.min(Math.max(w / h, 1 / MAX_ASPECT), MAX_ASPECT);
        const width = aspect >= 1 ? Math.round(GAME_SHORT_SIDE * aspect) : GAME_SHORT_SIDE;
        const height = aspect >= 1 ? GAME_SHORT_SIDE : Math.round(GAME_SHORT_SIDE / aspect);
        const size = game.scale.gameSize;
        if (size.width !== width || size.height !== height) game.scale.setGameSize(width, height);
    };
    fit();
    new ResizeObserver(fit).observe(parent);
}

// While a DOM form field is focused (the sign-in / sign-up email + password
// boxes, etc.), stop Phaser from handling the keyboard. Otherwise letters like
// "A"/"S"/"D" and space fire the dog's actions and are swallowed before they
// reach the input, so students can't type their credentials.
//
// Two gotchas: (1) the swallowing is done by the game-wide KeyboardManager, which
// preventDefault()s every captured key no matter what the per-scene keyboard
// plugins are set to, so the manager itself has to be switched off; (2) focusout
// doesn't reliably fire when a focused field is removed from the page (the dex
// re-renders its account bar), so instead of pairing focus events we re-check
// the focused element in a capture-phase listener that runs before Phaser's.
function installFormKeyboardGuard(game: Phaser.Game): void {
    const isField = (el: Element | null): boolean => {
        const n = el as HTMLElement | null;
        if (!n || !n.tagName) return false;
        return n.tagName === 'INPUT' || n.tagName === 'TEXTAREA'
            || n.tagName === 'SELECT' || n.isContentEditable;
    };
    const sync = (): void => {
        const on = !isField(document.activeElement);
        const manager = game.input.keyboard;
        if (manager) manager.enabled = on;
        game.scene.getScenes(false).forEach(s => {
            const kb = s.input?.keyboard;
            if (kb) kb.enabled = on;
        });
    };
    window.addEventListener('keydown', sync, true);
    window.addEventListener('keyup', sync, true);
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', () => setTimeout(sync, 0));
}

const config = {
    type: Phaser.AUTO,
    // Black, to match the page behind the canvas (any uncovered edge reads as
    // letterboxing rather than a white glitch).
    backgroundColor: '#000000',
    // Crisp upscaling of the pixel art now that FIT stretches the canvas to fill
    // an iPad screen (default linear filtering would blur it).
    pixelArt: true,
    scene: [
        TestScene, HomeScene, HardwareScene, HannafordScene, AutoScene, LibraryScene, WoodsScene, DesertScene, JungleScene, CityScene,
        CityPowerTowerScene, CityFinanceScene, CityLargeTowerScene, CityChurchScene,
        CityFashionScene, CityRadioTowerScene, CityPowerStationScene, CityRadioTower2Scene,
        CityMuseumScene, CityMuseumB1Scene, CityMuseumB2Scene, CityMuseumB3Scene, CityMuseumB4Scene,
        AtlantisScene,
    ],
    plugins: {
        scene: [
            {
                key: "gridEngine",
                plugin: GridEngine,
                mapping: "gridEngine",
            },
        ],
    },
    scale: {
        parent: 'phaser-game',
        // FIT scales the game up to fill the device screen while keeping its
        // aspect ratio — on an iPad the fixed box would otherwise sit tiny in the
        // middle. CENTER_BOTH keeps it centred within any letterboxing.
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        // Starting size only (4:3, the landscape iPad shape). Once the game is
        // ready, fitGameToScreen reshapes it to the actual screen.
        width: 800,
        height: 600
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
};
// The game is created inside the async bootstrap above (after settings load).
