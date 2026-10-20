import 'phaser';
import { CollisionStrategy } from 'grid-engine';

import GameScene from './GameScene';
import GlobalInfo from '../GlobalInfo';
import { LayerType } from './enums/LayerType';
import { Door } from './components/Door';
import { drawDoorCue } from './components/DoorCue';
import { SceneName } from './enums/SceneNames';
import { MAPS } from '../data/maps';
import { showNpcDialog } from '../ui/NpcDialog';
import { openCanopyOverlay } from '../ui/CanopyOverlay';
import { getElement } from '../data/elements';
import { TOTEMS, Totem, totemZ, configString } from '../data/aufbau';
import { isCaught, isTotemAttuned, isCanopyAttuned } from '../data/progress';

// A placed totem: its data, the trigger tile, the carved stone sprite, the lit gem
// (added on solve) and the gem's world position on the totem's face.
type TotemRec = {
    totem: Totem;
    tile: { x: number; y: number };
    sprite?: Phaser.GameObjects.Image;
    gem?: Phaser.GameObjects.Arc;
    gemPos: { x: number; y: number };
};

// The Jungle (level 2) — a dense rainforest. In the level progression you reach
// it FROM the City and leave onward to the Desert (City → Jungle → Desert).
// Built from the Lost Valleys jungle pack by tools/gen_jungle.py: a deep-green
// grass expanse walled in by trees, carved with earthy dirt clearings, dotted
// with rock-ringed water ponds, and blanketed in ferns, rocks and moss (all the
// scenery object layer, same pattern as the woods/desert). No wild Elementals
// You arrive at the SOUTH entrance (START, by the "CITY" pad) and walk NORTH to the
// "DESERT" pad that leads onward to the finale.
//
// LESSON TWO — the "Canopy Energy Network" (electron configuration; see
// JUNGLE-LESSON2-PLAN.md + data/aufbau.ts). Dormant animal-spirit TOTEMS line the
// northward path, one per element you can catch. Walk onto a totem whose element
// you've CAUGHT (dev/?debug/?e2e bypasses) and ui/CanopyOverlay opens: channel
// electron-seeds up a vertical orbital lattice, in Aufbau order, to configure it
// (Carbon = 1s²2s²2p²…). Configure them all and the network powers up, awarding the
// Canopy Key (a bonus secret — NOT a gate; the Jungle→Desert pad stays open always).
export default class JungleScene extends GameScene {
    private static readonly EXIT = { x: 40, y: 49 };    // south pad → back to the City
    private static readonly ONWARD = { x: 40, y: 0 };   // north pad → onward to the Desert
    private static readonly START = { x: 40, y: 47 };

    // The totems march up the central corridor from the entrance (Carbon, y45) to the
    // Desert pad (Iron, y4), paired with TOTEMS by index so you climb the "energy
    // ladder" as you walk north. Eight tiles, spread the full length so the shorter
    // (curated-8) totem set still spans the corridor rather than bunching at the south
    // end; every y here is drawn from the originally verified-walkable set (clear of
    // trees/rocks/ponds). Any that somehow isn't is skipped at runtime (walls-layer
    // check), exactly like the desert's spawn candidates.
    private static readonly TOTEM_TILES = [
        { x: 40, y: 45 }, { x: 40, y: 41 }, { x: 40, y: 35 }, { x: 40, y: 28 },
        { x: 40, y: 22 }, { x: 40, y: 15 }, { x: 40, y: 8 }, { x: 40, y: 4 },
    ];
    private static readonly TOTEM_W = 1.3;       // totem sprite display width, in tiles
    private static readonly GEM_FRAC = 0.2632;   // gem socket y / sprite height (tools/gen_totems.py)

    constructor() {
        super(SceneName.Jungle, JungleScene.START.x, JungleScene.START.y,
            [LayerType.Floor, LayerType.Walls, LayerType.Overhead]);

        this.imageNames = {
            Perli: `${SceneName.Jungle}_perli`,
            Veterinary: `${SceneName.Jungle}_veterinary`,
            Map: 'jungle_map',
        };

        this.tilemapJSONPath = 'assets/tilemap/jungle_map.json';
        this.imageMapDefaultPath = 'assets/tiles/';
        this.mapData = MAPS.jungle_map;
        // Two tilesets: the composed jungle ground sheet + blank16 (invisible
        // collision under props and over the ponds). Names must match the tilemap.
        this.imageMapNames = {
            jungle_tileset: { name: 'jungle_tileset' },
            blank16: { name: 'blank16' },
        };

        this.gridEngineSettings = {
            startPosition: { ...JungleScene.START },
            scale: 5,
            characterCollisionStrategy: CollisionStrategy.BLOCK_ONE_TILE_AHEAD,
            layerOverlay: false,
        };
    }

    preload(): void {
        super.preload();
        super.loadAvatarSpritesheet();
        super.loadMapImages();
        this.loadObjectImages();
        this.loadTotemImages();
        this.loadElementalImages();
    }

    // The carved stone totem sprites (tools/gen_totems.py), one per lesson-two totem.
    private loadTotemImages(): void {
        TOTEMS.forEach(t => this.load.image(`jungle_totem_${t.id}`, `assets/jungle/totem-${t.id}.png`));
    }

    // Wild Elementals that roam the jungle: the 3p-block creatures. Silicon and Argon
    // have totems on the corridor (catch them here, then wake their totems right here);
    // Phosphorus and Chlorine are catchable for the Isotopedex but, since the totem arc
    // was curated down to eight, no longer have totems of their own. Load the shared NPC
    // sheet (fallback) + their real art, mirroring DesertScene.
    private static readonly WILD_ELEMENTALS = ['silicon', 'phosphorus', 'chlorine', 'argon'];
    // Tucked in the jungle's clearings, off the central totem corridor, so finding them
    // (cloaked — Rad Finder) is a hunt. Walkability-filtered at spawn, first 4 used.
    private static readonly SPAWN_CANDIDATES = [
        { x: 14, y: 11 }, { x: 58, y: 10 }, { x: 20, y: 35 }, { x: 64, y: 37 },
        { x: 52, y: 15 }, { x: 18, y: 42 }, { x: 62, y: 30 }, { x: 12, y: 25 },
    ];
    private loadElementalImages(): void {
        this.load.spritesheet(this.imageNames.Veterinary,
            'assets/Characters/NPCs_1.png', { frameWidth: 32, frameHeight: 64 });
        this.loadElementalArt(JungleScene.WILD_ELEMENTALS);
    }

    // Depths mirror the woods/desert: tree canopies render ABOVE the player so you
    // walk behind/under them; ground props (ferns, rocks, moss) sit below.
    private static readonly CHAR_DEPTH = 10;
    private static readonly OVERHEAD_DEPTH = JungleScene.CHAR_DEPTH + 10;
    private static readonly GROUND_DEPTH = JungleScene.CHAR_DEPTH - 4;
    private static readonly SCENERY: Record<string,
        { keys: string[]; tilesW: number; depth: number }> = {
        // Canopy shared with the North Woods (woods_tree_*) plus the two green
        // jungle trees as accents, so the biomes feel of a piece.
        tree: { keys: ['woods_tree_1', 'woods_tree_2', 'woods_tree_3', 'jungle_tree_1', 'jungle_tree_2'],
                tilesW: 3, depth: JungleScene.OVERHEAD_DEPTH },
        fern: { keys: ['jungle_fern_1', 'jungle_fern_2', 'jungle_fern_3',
                       'jungle_fern_4', 'jungle_fern_5', 'jungle_fern_6'],
                tilesW: 1, depth: JungleScene.GROUND_DEPTH },
        rock: { keys: ['jungle_rock_1', 'jungle_rock_2', 'jungle_rock_3', 'jungle_rock_4',
                       'jungle_rock_5', 'jungle_rock_6', 'jungle_rock_7', 'jungle_rock_8'],
                tilesW: 1, depth: JungleScene.GROUND_DEPTH },
        moss: { keys: ['jungle_moss_1', 'jungle_moss_2', 'jungle_moss_3'],
                tilesW: 7, depth: JungleScene.GROUND_DEPTH - 2 },
    };

    // Ambient fauna spritesheets (animated, placed in code — not scenery objects).
    // Just the teal slimes by the ponds. Frame grid comes from slice_jungle.py.
    private static readonly FAUNA: Record<string,
        { frameW: number; frameH: number; frames: [number, number]; rate: number }> = {
        jungle_slime: { frameW: 36, frameH: 28, frames: [0, 3], rate: 5 },
    };

    loadObjectImages(): void {
        // Key prefix picks the asset folder: woods_tree_1 -> assets/woods/tree-1.png,
        // jungle_moss_1 -> assets/jungle/moss-1.png. Lets the jungle borrow woods art.
        const seen = new Set<string>();
        Object.values(JungleScene.SCENERY).forEach(spec =>
            spec.keys.forEach(key => {
                if (seen.has(key)) return;
                seen.add(key);
                const [dir, ...rest] = key.split('_');
                this.load.image(key, `assets/${dir}/${rest.join('-')}.png`);
            }));
        Object.entries(JungleScene.FAUNA).forEach(([key, f]) =>
            this.load.spritesheet(key, `assets/jungle/${key.replace('jungle_', '')}-sheet.png`,
                { frameWidth: f.frameW, frameHeight: f.frameH }));
    }

    // Drop ambient creatures: goblins guarding the ruins, slimes + crabs haunting
    // the ponds. Each loops an idle animation and drifts gently side to side
    // (skipped under prefers-reduced-motion, matching the rest of the game).
    private spawnFauna(): void {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        Object.entries(JungleScene.FAUNA).forEach(([key, f]) => {
            const anim = `${key}_idle`;
            if (!this.anims.exists(anim)) {
                this.anims.create({
                    key: anim, frameRate: f.rate, repeat: -1,
                    frames: this.anims.generateFrameNumbers(key, { start: f.frames[0], end: f.frames[1] }),
                });
            }
        });
        const tw = this.map.tileWidth;
        const critter = (key: string, tx: number, ty: number, tilesH: number, drift: number): void => {
            const spr = this.add.sprite(tx * tw + tw / 2, (ty + 1) * tw, key).setOrigin(0.5, 1);
            spr.setScale((tilesH * tw) / JungleScene.FAUNA[key].frameH);
            spr.setDepth(JungleScene.CHAR_DEPTH - 1);
            if (reduce) { spr.setFrame(JungleScene.FAUNA[key].frames[0]); return; }
            spr.play(`${key}_idle`);
            this.tweens.add({
                targets: spr, x: spr.x + drift * tw, duration: 2600, yoyo: true, repeat: -1,
                ease: 'Sine.easeInOut',
                onYoyo: () => spr.setFlipX(drift < 0), onRepeat: () => spr.setFlipX(drift > 0),
            });
        };
        // teal slimes drifting by the four ponds
        critter('jungle_slime', 22, 17, 1.3, 1.5);
        critter('jungle_slime', 31, 17, 1.3, -1.5);
        critter('jungle_slime', 49, 25, 1.3, 2);
        critter('jungle_slime', 16, 42, 1.3, -1.2);
        critter('jungle_slime', 64, 28, 1.3, 1.5);
    }

    // Drop the scenery sprites named in the tilemap's `scenery` object layer. Base
    // anchored at the object point (bottom-centre); width set in tiles so art keeps
    // its natural size; depth decides over/under the player. (variant is 0-based,
    // matching gen_jungle.py.)
    placeScenery(): void {
        const layer = this.map.getObjectLayer('scenery');
        if (!layer) return;
        layer.objects.forEach((obj, idx) => {
            const spec = JungleScene.SCENERY[obj.name ?? ''];
            if (!spec || obj.x == null || obj.y == null) return;
            const props: Record<string, unknown> = {};
            (obj.properties as { name: string; value: unknown }[] | undefined)
                ?.forEach(p => { props[p.name] = p.value; });
            const variant = (typeof props.variant === 'number' ? props.variant : idx)
                % spec.keys.length;
            const tilesW = typeof props.tw === 'number' ? props.tw : spec.tilesW;
            const img = this.add.image(obj.x, obj.y, spec.keys[variant]).setOrigin(0.5, 1);
            img.setScale((tilesW * this.map.tileWidth) / img.width);
            img.setDepth(spec.depth);
        });
    }

    create(): void {
        super.create();

        // Lift the (empty) overhead layer above the player, matching the woods, so
        // any future canopy tiles render on top; then drop the scenery sprites.
        this.map.getLayer(LayerType.Overhead)?.tilemapLayer
            ?.setDepth(JungleScene.OVERHEAD_DEPTH);
        this.placeScenery();
        this.spawnFauna();

        // South exit back to the City: a glowing "CITY ▼" pad at the bottom edge
        // (this is where you arrive from the City). Step onto the pad to return.
        new Door({
            scene: this, xPosition: JungleScene.EXIT.x, yPosition: JungleScene.EXIT.y,
            nextScene: SceneName.City, entryOffset: { dx: 0, dy: -1 },
        });
        drawDoorCue(this, JungleScene.EXIT.x, JungleScene.EXIT.y - 1, 'CITY', '▼');

        // North trail onward to the Desert (level 3 finale): a "DESERT ▲" pad at the
        // top edge. Walk the length of the jungle to reach it.
        new Door({
            scene: this, xPosition: JungleScene.ONWARD.x, yPosition: JungleScene.ONWARD.y,
            nextScene: SceneName.Desert, entryOffset: { dx: 0, dy: 1 },
        });
        drawDoorCue(this, JungleScene.ONWARD.x, JungleScene.ONWARD.y + 1, 'DESERT', '▲');

        // --- Lesson two: the Canopy Energy Network totems -----------------------
        this.placeTotems();
        // A returning player who already powered the network: totems are lit on load,
        // so don't replay the awakening cue.
        if (isCanopyAttuned()) this.canopyCelebrated = true;
        const sub = this.gridEngine.movementStopped().subscribe((o) => {
            if (o.charId !== this.playerName) return;
            if (GlobalInfo._gameProgress.inDialogue) return;
            const p = this.gridEngine.getPosition(this.playerName);
            const rec = this.placedTotems.find(r => r.tile.x === p.x && r.tile.y === p.y);
            if (rec) this.onApproachTotem(rec);
        });
        this.events.once('shutdown', () => sub.unsubscribe());
    }

    // The 3p-block Elementals roam the jungle, cloaked (Rad-Finder-found), tucked in the
    // clearings off the totem corridor. Catch them here, then wake their totems. Any
    // candidate that landed on collision is skipped; the first four walkable tiles get used.
    createNpcs(): void {
        const free = JungleScene.SPAWN_CANDIDATES.filter(t =>
            !this.map.getTileAt(t.x, t.y, false, LayerType.Walls));
        JungleScene.WILD_ELEMENTALS.forEach((id, i) => {
            const tile = free[i];
            if (tile) this.spawnElemental(id, tile.x, tile.y);
        });
    }

    // ---- Canopy totems -----------------------------------------------------------
    private placedTotems: TotemRec[] = [];
    private hintedTotem = new Set<string>();
    private canopyCelebrated = false;

    private isDev(): boolean { return /[?&](dev|debug|e2e)\b/.test(location.search); }

    /** A soft glowing dot we tint amber for the drifting electron-seed fireflies. */
    private ensureSeedTexture(): void {
        if (this.textures.exists('canopy_seed')) return;
        const g = this.make.graphics({ x: 0, y: 0 }, false);
        g.fillStyle(0xffffff, 0.25); g.fillCircle(8, 8, 7);
        g.fillStyle(0xffffff, 0.6);  g.fillCircle(8, 8, 4);
        g.fillStyle(0xffffff, 1.0);  g.fillCircle(8, 8, 2);
        g.generateTexture('canopy_seed', 16, 16);
        g.destroy();
    }

    /** Place each totem: a floor step-on cue (spirit name + ✦) with the carved stone
     *  totem standing just NORTH of it (so the player stands in front, never hidden),
     *  plus drifting fireflies. Tiles that aren't walkable are skipped; already-
     *  configured totems are relit. */
    private placeTotems(): void {
        this.placedTotems = [];
        this.ensureSeedTexture();
        const tw = this.map.tileWidth;
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        TOTEMS.forEach((totem, i) => {
            const tile = JungleScene.TOTEM_TILES[i];
            if (!tile) return;
            if (this.map.getTileAt(tile.x, tile.y, false, LayerType.Walls)) return;  // blocked — skip
            drawDoorCue(this, tile.x, tile.y, totem.spirit.toUpperCase(), '✦');

            const bx = tile.x * tw + tw / 2;
            const by = tile.y * tw;                 // base at the tile's TOP edge → totem rises behind
            const key = `jungle_totem_${totem.id}`;
            let sprite: Phaser.GameObjects.Image | undefined;
            let gemPos = { x: bx, y: by - tw };     // fallback if the art is missing
            if (this.textures.exists(key)) {
                sprite = this.add.image(bx, by, key).setOrigin(0.5, 1)
                    .setDepth(JungleScene.CHAR_DEPTH - 1);   // just behind the player
                sprite.setScale((JungleScene.TOTEM_W * tw) / sprite.width);
                gemPos = { x: bx, y: by - sprite.displayHeight * (1 - JungleScene.GEM_FRAC) };
            }
            const rec: TotemRec = { totem, tile, sprite, gemPos };
            this.placedTotems.push(rec);
            if (!reduce) this.spawnTotemFireflies(rec);
            if (isTotemAttuned(totem.id)) this.lightTotem(rec);
        });
    }

    /** Two amber electron-seeds drifting up from the totem base and fading (fireflies).
     *  Skipped under prefers-reduced-motion (caller guards). */
    private spawnTotemFireflies(rec: TotemRec): void {
        const tw = this.map.tileWidth;
        const cx = rec.tile.x * tw + tw / 2;
        const baseY = rec.tile.y * tw;              // totem base
        for (let k = 0; k < 2; k++) {
            const dot = this.add.image(cx + Phaser.Math.Between(-6, 6), baseY, 'canopy_seed')
                .setDepth(JungleScene.CHAR_DEPTH + 1).setTint(0xffd166).setScale(0.5).setAlpha(0.85);
            this.tweens.add({
                targets: dot, y: baseY - tw * 1.8, alpha: { from: 0.85, to: 0 },
                duration: Phaser.Math.Between(2200, 3200), ease: 'Sine.easeOut',
                delay: k * 900, repeat: -1,
                onRepeat: () => { dot.y = baseY; dot.x = cx + Phaser.Math.Between(-6, 6); dot.setAlpha(0.85); },
            });
        }
    }

    /** Light a configured totem's gem on its carved face (pulsing aura in its colour). */
    private lightTotem(rec: TotemRec): void {
        if (rec.gem) return;
        const tw = this.map.tileWidth;
        const color = parseInt(rec.totem.gem.slice(1), 16);
        const gem = this.add.circle(rec.gemPos.x, rec.gemPos.y, tw * 0.28, color, 0.95)
            .setDepth(JungleScene.CHAR_DEPTH - 0.5);   // on the totem face, above the stone
        rec.gem = gem;
        if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            this.tweens.add({
                targets: gem, alpha: { from: 0.55, to: 1 }, scale: { from: 0.8, to: 1.15 },
                duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
        }
    }

    // Walk onto a totem. Already configured → a quick dialog echoing its config.
    // Otherwise the element must be CAUGHT to wake it (dev/?debug/?e2e bypass); if so,
    // open the Canopy overlay, relight any newly-configured totems on close, and — if
    // that completed the whole network — play the one-time awakening cue.
    private onApproachTotem(rec: TotemRec): void {
        const { totem } = rec;
        const el = getElement(totem.id);
        if (isTotemAttuned(totem.id)) {
            showNpcDialog(`${totem.spirit} Totem`, [
                `${el?.name ?? 'This spirit'} already channels its electrons in order:`,
                configString(totemZ(totem)),
            ]);
            return;
        }
        if (!isCaught(totem.id) && !this.isDev()) {
            if (!this.hintedTotem.has(totem.id)) {
                this.hintedTotem.add(totem.id);
                showNpcDialog(`${totem.spirit} Totem`, [
                    `This totem sleeps. Its ${el?.name ?? 'element'} spirit will not wake until you have caught ${el?.name ?? 'it'} on your journey.`,
                ]);
            }
            return;
        }
        openCanopyOverlay(() => {
            this.placedTotems.forEach(r => { if (isTotemAttuned(r.totem.id)) this.lightTotem(r); });
            if (isCanopyAttuned() && !this.canopyCelebrated) this.celebrateCanopy();
        });
    }

    // The Canopy Key payoff (JUNGLE-LESSON2-PLAN decision #4): a bonus "grove of light"
    // celebration, NOT a gate — the Jungle→Desert pad was always open. Every totem lights
    // and the grove flares once; prefers-reduced-motion skips the flash + bursts.
    private celebrateCanopy(): void {
        if (this.canopyCelebrated) return;
        this.canopyCelebrated = true;
        this.placedTotems.forEach(r => this.lightTotem(r));   // persistent lit grove
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        if (!reduce) {
            this.cameras.main.flash(500, 120, 255, 150);       // a green light sweep
            this.placedTotems.forEach((r, i) => this.time.delayedCall(i * 80, () => {
                if (r.gem) this.tweens.add({ targets: r.gem, scale: 2.2, duration: 260, yoyo: true, ease: 'Quad.easeOut' });
            }));
        }
        this.showCanopyTitle();
    }

    private showCanopyTitle(): void {
        const cam = this.cameras.main;
        const t = this.add.text(cam.width / 2, cam.height * 0.16,
            'The Canopy Energy Network awakens!',
            { fontFamily: 'monospace', fontSize: '15px', color: '#eaffe0', stroke: '#123018', strokeThickness: 4, align: 'center' })
            .setOrigin(0.5).setScrollFactor(0).setDepth(9999).setAlpha(0);
        this.tweens.add({ targets: t, alpha: 1, duration: 600, yoyo: true, hold: 1800, onComplete: () => t.destroy() });
    }

    update(): void {
        super.update();
    }
}
