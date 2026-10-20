import 'phaser';
import { CollisionStrategy } from 'grid-engine';

import GameScene from './GameScene';
import { LayerType } from './enums/LayerType';
import { Door } from './components/Door';
import { Npc } from './components/Npc';
import { Portal, MUSEUM_ARRIVAL } from './components/Portal';
import { SceneName } from './enums/SceneNames';
import { showLeaveButton, hideLeaveButton } from '../ui/LeaveButton';
import { drawDoorCue } from './components/DoorCue';
import { showNpcDialog } from '../ui/NpcDialog';
import { openEvolveOverlay } from '../ui/EvolveOverlay';
import { MAPS } from '../data/maps';
import { INTERIOR_NAV, InteriorFloorNav } from '../data/interiorNav';
import { hasItem, MAGIC_KEY } from '../data/progress';
import GlobalInfo from '../GlobalInfo';
import { openResonanceOverlay } from '../ui/ResonanceOverlay';

// The interiors of the City buildings (reached by stepping onto a building's
// door in CityScene). Unlike the square Luna-Town rooms, the city interior art
// is wide 1408x768, so these use their own landscape 22x12 collision grid
// (city_interior.json / tools/gen_city_interior.py) — a plain open room with a
// one-tile wall border. Every room has a bottom-centre door back out; the
// museum additionally has a top-centre "deeper" door that chains down through
// four basement levels.

interface CityRoomConfig {
    background: string;   // image file under assets/rooms/
    up: SceneName;        // ascend target: leave the building, or climb one level up
    upLabel: string;      // 'EXIT' (ground floors) or 'UP' (basements)
    down?: SceneName;     // descend target: one level deeper (museum only)
    elementIds?: string[]; // Elementals to place in this room (default: none)
    // Museum floors pass a per-floor collision map key (museum_ground / museum_b1..b4).
    // When set, the room uses that painted collision grid and navigates via painted
    // portals (see museumNav.ts) instead of the fixed centre doors.
    collisionMap?: string;
    // Repurpose this floor as the Evolution Lab: spawn a console technician you walk
    // up to (proximity) that opens the evolution overlay. See spawnEvolutionConsole.
    lab?: boolean;
}

// Shared landscape-room behaviour. Concrete scenes below only supply their art
// and which scenes their doors lead to.
abstract class CityInteriorScene extends GameScene {
    private static readonly START = { x: 11, y: 6 };
    private static readonly EXIT = { x: 11, y: 11 };   // bottom wall — the way out
    private static readonly DEEPER = { x: 11, y: 0 };  // top wall — deeper (museum)

    // Tiles an Elemental can stand on. The interior is a wide-open 20x10 room
    // (walkable cols 1-20, rows 1-10 — see city_interior.json). We lay creatures
    // on a spaced grid that skips: the door step-pad rows (y=1 top, y=10 bottom),
    // the player's start row (y=6), and the central column corridor (x=10-12)
    // the dog walks between the two doors. Tiles sit >=2 apart so adjacent
    // monsters' proximity quizzes don't overlap. Yields 36 slots per floor →
    // 180 across the 5 museum floors, ample for the full periodic-table roster.
    private static readonly SPAWN_TILES: { x: number; y: number }[] =
        ([2, 4, 7, 9] as const).flatMap(y =>
            [1, 3, 5, 7, 9, 13, 15, 17, 19].map(x => ({ x, y })));

    private readonly cfg: CityRoomConfig;
    private readonly bgKey: string;
    private bgImage?: Phaser.GameObjects.Image;
    private readonly elementIds: string[];
    private readonly nav?: InteriorFloorNav;   // set for painted rooms (portal nav)
    private readonly sceneKey: SceneName;
    private sanctumPortalCreated = false;      // the key-gated Atlantis tunnel (B4)

    constructor(sceneName: SceneName, cfg: CityRoomConfig) {
        const nav = cfg.collisionMap ? INTERIOR_NAV[cfg.collisionMap] : undefined;
        const start = nav?.start ?? CityInteriorScene.START;
        super(sceneName, start.x, start.y, [LayerType.Floor, LayerType.Walls]);
        this.cfg = cfg;
        this.nav = nav;
        this.sceneKey = sceneName;
        this.bgKey = `${sceneName}_bg`;
        this.elementIds = cfg.elementIds ?? [];

        this.imageNames = {
            Perli: `${sceneName}_perli`,
            Veterinary: `${sceneName}_veterinary`,
            Map: `${sceneName}_room`,
        };

        // Museum floors use their own painted collision grid; other city buildings
        // share the plain open room.
        const mapKey = cfg.collisionMap ?? 'city_interior';
        this.tilemapJSONPath = `assets/tilemap/${mapKey}.json`;
        this.mapData = MAPS[mapKey];
        this.imageMapDefaultPath = 'assets/tiles/';
        this.imageMapNames = { blank16: { name: 'blank16' } };

        this.gridEngineSettings = {
            startPosition: { ...start },
            scale: 5,
            characterCollisionStrategy: CollisionStrategy.BLOCK_ONE_TILE_AHEAD,
            layerOverlay: false,
        };
    }

    preload(): void {
        super.preload();
        super.loadAvatarSpritesheet();
        super.loadMapImages();
        // Load any assigned Elementals' art (no-op for the empty rooms — every city
        // building except a populated museum floor). Without this a floor's
        // Elementals would spawn with a missing texture.
        this.loadObjectImages();
        this.load.image(this.bgKey, `assets/rooms/${this.cfg.background}`);
    }

    // With no Elementals assigned the room is just a background image + the dog.
    // When a room does host Elementals, load their art plus the shared NPC
    // spritesheet that spawnElemental falls back to for creatures lacking art.
    loadObjectImages(): void {
        // The NPC sheet is needed for Elementals' fallback art AND the lab console
        // technician, so load it when either is present.
        if (this.elementIds.length === 0 && !this.cfg.lab) return;
        this.load.spritesheet(this.imageNames.Veterinary,
            'assets/Characters/NPCs_1.png',
            { frameWidth: 32, frameHeight: 64 });
        if (this.elementIds.length) this.loadElementalArt(this.elementIds);
    }

    create(): void {
        // Resolve a pending portal arrival BEFORE the scene is built, so the player
        // is created directly on the arrival portal. (Teleporting with setPosition
        // mid-create was fragile and could abort create → white screen.)
        if (this.nav) this.resolveArrivalStart();

        super.create();

        // Room art stretched over the whole grid, behind every sprite. The grid
        // matches the art's 11:6 aspect, so nothing is squished. Freed on sleep and
        // reloaded on wake (see addBackground/freeBackground) so the interiors the
        // player has visited don't accumulate GPU texture memory — the
        // "page unresponsive" cause on iPad, where each room bg is ~4 MB of VRAM.
        this.addBackground();
        this.events.on('sleep', () => this.freeBackground());
        this.events.on('wake', () => this.reloadBackground());
        this.events.on('shutdown', () => this.freeBackground());

        // Fixed camera zoom (same as the town interiors — see createCamera). The old
        // cover-zoom over-zoomed these wide rooms on tall/portrait screens; any
        // uncovered margin now letterboxes to black instead.

        if (this.nav) {
            this.createPortals();
            // Re-entering an already-built (sleeping) floor doesn't re-run create,
            // and the dog is left standing on whatever portal it exited by. Put it
            // back on the arrival portal (museum hops) or the safe start tile
            // (door re-entry) so it never wakes up sitting on a trigger.
            this.events.on('wake', () => {
                this.createSanctumPortalIfUnlocked();   // may have found the key since
                this.repositionOnWake();
            });
        } else {
            this.createDoors();
        }

        // A one-tap DOM "Leave" button always escapes straight back to the city,
        // however deep in the basement you are.
        const leave = (): void => this.switch(SceneName.City);
        showLeaveButton(leave);
        this.events.on('wake', () => showLeaveButton(leave));
        this.events.on('sleep', () => hideLeaveButton());
        this.events.on('shutdown', () => hideLeaveButton());
    }

    // Fixed centre doors for the plain open-room buildings (non-museum).
    private createDoors(): void {
        new Door({
            scene: this, xPosition: CityInteriorScene.EXIT.x, yPosition: CityInteriorScene.EXIT.y,
            nextScene: this.cfg.up, entryOffset: { dx: 0, dy: -1 },
        });
        drawDoorCue(this, CityInteriorScene.EXIT.x, CityInteriorScene.EXIT.y - 1, this.cfg.upLabel, '▼');
        if (this.cfg.down) {
            new Door({
                scene: this, xPosition: CityInteriorScene.DEEPER.x, yPosition: CityInteriorScene.DEEPER.y,
                nextScene: this.cfg.down, entryOffset: { dx: 0, dy: 1 },
            });
            drawDoorCue(this, CityInteriorScene.DEEPER.x, CityInteriorScene.DEEPER.y + 1, 'DEEPER', '▲');
        }
    }

    // Museum floors: place a teleport tile for each painted portal group. ascend
    // (green) -> the floor above (cfg.up), descend (blue) -> the floor below
    // (cfg.down), custom (purple) -> Atlantis sanctum (key-gated). Arriving via one lands the player
    // on the opposite portal of the destination floor (see MUSEUM_ARRIVAL).
    private createPortals(): void {
        const nav = this.nav!;
        const tilesOf = (t: 'ascend' | 'descend' | 'custom'): { x: number; y: number }[] =>
            nav.portals.filter(p => p.type === t).map(p => ({ x: p.x, y: p.y }));

        const ascend = tilesOf('ascend');
        if (ascend.length) {
            new Portal(this, ascend, this.cfg.up,
                { color: 0x39d353, symbol: '▲', label: this.cfg.upLabel }, 'descend');
        } else {
            // No painted exit portal — keep the fixed centre exit door as a safety net.
            new Door({
                scene: this, xPosition: CityInteriorScene.EXIT.x, yPosition: CityInteriorScene.EXIT.y,
                nextScene: this.cfg.up, entryOffset: { dx: 0, dy: -1 },
            });
            drawDoorCue(this, CityInteriorScene.EXIT.x, CityInteriorScene.EXIT.y - 1, this.cfg.upLabel, '▼');
        }
        const descend = tilesOf('descend');
        if (descend.length && this.cfg.down) {
            new Portal(this, descend, this.cfg.down,
                { color: 0x4098ff, symbol: '▼', label: 'DOWN' }, 'ascend');
        }
        // The 'custom' portal is the HIDDEN sanctum tunnel (museum B4). It is not a
        // public square — it only exists once the player has the Magic Key. See below.
        this.createSanctumPortalIfUnlocked();
    }

    // The tunnel to the Atlantis sanctum: a 'custom' portal that stays completely
    // hidden (no pad, no trigger — the tile reads as plain floor) until the player
    // has found the Magic Key in the forest chest. Guarded so it's created at most
    // once, and re-checked on `wake` so it appears if the key was picked up AFTER
    // this floor was first entered (scenes don't re-run create on wake).
    private createSanctumPortalIfUnlocked(): void {
        if (this.sanctumPortalCreated || !this.nav) return;
        if (!hasItem(MAGIC_KEY)) return;
        const custom = this.nav.portals.filter(p => p.type === 'custom').map(p => ({ x: p.x, y: p.y }));
        if (!custom.length) return;
        new Portal(this, custom, SceneName.Atlantis,
            { color: 0x8fd6ff, symbol: '✦', label: 'SANCTUM' });
        this.sanctumPortalCreated = true;
    }

    // Pending portal arrival tile for this floor, or undefined. Consumes the
    // MUSEUM_ARRIVAL handoff set by the portal that sent us here.
    private takeArrivalTile(): { x: number; y: number } | undefined {
        if (!this.nav) return undefined;
        const want = MUSEUM_ARRIVAL[this.sceneKey];
        if (!want) return undefined;
        delete MUSEUM_ARRIVAL[this.sceneKey];
        const p = this.nav.portals.find(pt => pt.type === want);
        return p ? { x: p.land.x, y: p.land.y } : undefined;   // land beside, not on, the portal
    }

    // First visit: bias the player's spawn onto the arrival portal before the
    // scene (and grid-engine) are built, so no mid-create teleport is needed.
    private resolveArrivalStart(): void {
        const tile = this.takeArrivalTile();
        if (tile) this.gridEngineSettings.startPosition = tile;
    }

    // Revisiting an already-built (sleeping) floor: land on the arrival portal if we
    // came via a portal, otherwise reset to the safe start tile (door re-entry —
    // never leave the dog on the exit portal it left by). Guarded so a bad tile
    // can never freeze the scene.
    private repositionOnWake(): void {
        const tile = this.takeArrivalTile() ?? this.nav?.start;
        if (!tile) return;
        try {
            this.gridEngine.setPosition(this.playerName, { x: tile.x, y: tile.y });
            this.characterMoved = false;   // don't instantly re-trigger a portal
        } catch { /* non-fatal: leave the player where they were */ }
    }

    // Place each assigned Elemental on a spawn tile. Rooms with no elementIds
    // (every city building today) stay empty, exactly as before. On painted museum
    // floors, skip slots that landed on a wall/pit or on a portal tile so no
    // creature is trapped in scenery or standing on a teleport.
    createNpcs(): void {
        const portalCells = new Set((this.nav?.portals ?? []).map(p => `${p.x},${p.y}`));
        const tiles = CityInteriorScene.SPAWN_TILES.filter(t =>
            !this.map.getTileAt(t.x, t.y, false, LayerType.Walls) &&
            !portalCells.has(`${t.x},${t.y}`));
        this.elementIds.forEach((id, i) => {
            const tile = tiles[i];
            if (!tile) return;   // more Elementals than free slots — extras are skipped
            this.spawnElemental(id, tile.x, tile.y);
        });
        if (this.cfg.lab) this.spawnEvolutionConsole(tiles.slice(this.elementIds.length));
    }

    // The Evolution Lab console: a technician you walk up to (proximity) who opens
    // the evolution overlay. Dropped on the free spawn tile nearest the entrance and
    // marked with a glowing "EVOLVE" pad so it's findable.
    private spawnEvolutionConsole(freeTiles: { x: number; y: number }[]): void {
        const start = this.nav?.start ?? CityInteriorScene.START;
        const dist = (t: { x: number; y: number }) =>
            Math.abs(t.x - start.x) + Math.abs(t.y - start.y);
        const spot = freeTiles.length
            ? freeTiles.reduce((best, t) => (dist(t) < dist(best) ? t : best), freeTiles[0])
            : start;
        const tech = new Npc({
            scene: this, xPosition: spot.x, yPosition: spot.y,
            texture: this.imageNames.Veterinary, scale: 0.35, walkingAnimationMapping: 3,
            action: () => {
                tech.proximityTrigger = false;
                showNpcDialog('EVOLUTION LAB', [
                    'Welcome to the Evolution Lab!',
                    'Bond Elementals into a molecule, then shape its geometry to evolve them.',
                ], () => openEvolveOverlay(() => { tech.proximityTrigger = true; }));
            },
        });
        tech.proximityTrigger = true;
        drawDoorCue(this, spot.x, spot.y, 'EVOLVE', '▲');
    }

    // ---- room-background lifecycle (GPU-memory hygiene) ----
    // Scenes are never destroyed (switch() sleeps/wakes them), so without this every
    // city interior the player has entered would keep its large background texture
    // resident, growing GPU memory until iOS Safari drops the WebGL context
    // ("page unresponsive"). Free it on sleep/shutdown and lazily reload on wake, so
    // at most the current room's background is resident.
    private addBackground(): void {
        this.bgImage = this.add.image(0, 0, this.bgKey)
            .setOrigin(0, 0)
            .setDisplaySize(this.map.widthInPixels, this.map.heightInPixels)
            .setDepth(-100);
    }

    private freeBackground(): void {
        this.bgImage?.destroy();
        this.bgImage = undefined;
        if (this.textures.exists(this.bgKey)) this.textures.remove(this.bgKey);
    }

    private reloadBackground(): void {
        if (this.textures.exists(this.bgKey)) { this.addBackground(); return; }
        this.load.image(this.bgKey, `assets/rooms/${this.cfg.background}`);
        this.load.once(Phaser.Loader.Events.COMPLETE, () => {
            if (this.scene.isActive() && this.textures.exists(this.bgKey) && !this.bgImage) this.addBackground();
        });
        this.load.start();
    }

    update(): void {
        super.update();
    }
}

// ---- Standalone building interiors (bottom door → back out to the city) ----
export class CityPowerTowerScene extends CityInteriorScene {
    constructor() { super(SceneName.CityPowerTower, { background: 'power-tower-interior.png', up: SceneName.City, upLabel: 'EXIT', collisionMap: 'room_power_tower' }); }
}
export class CityFinanceScene extends CityInteriorScene {
    constructor() { super(SceneName.CityFinance, { background: 'finance-interior.png', up: SceneName.City, upLabel: 'EXIT', collisionMap: 'room_finance' }); }
}
export class CityLargeTowerScene extends CityInteriorScene {
    constructor() { super(SceneName.CityLargeTower, { background: 'large-tower-interior.png', up: SceneName.City, upLabel: 'EXIT', collisionMap: 'room_large_tower' }); }
}
export class CityChurchScene extends CityInteriorScene {
    constructor() { super(SceneName.CityChurch, { background: 'church-interior.png', up: SceneName.City, upLabel: 'EXIT', collisionMap: 'room_church' }); }
}
export class CityFashionScene extends CityInteriorScene {
    constructor() { super(SceneName.CityFashion, { background: 'fashion-interior.png', up: SceneName.City, upLabel: 'EXIT', collisionMap: 'room_fashion' }); }
}
export class CityRadioTowerScene extends CityInteriorScene {
    constructor() { super(SceneName.CityRadioTower, { background: 'radio-tower-interior.png', up: SceneName.City, upLabel: 'EXIT', collisionMap: 'room_radio_tower' }); }
}
export class CityPowerStationScene extends CityInteriorScene {
    // Repurposed as the Evolution Lab — a console technician runs molecular fusion.
    constructor() { super(SceneName.CityPowerStation, { background: 'power-station-interior.png', up: SceneName.City, upLabel: 'EXIT', collisionMap: 'room_power_station', lab: true }); }
}
export class CityRadioTower2Scene extends CityInteriorScene {
    constructor() { super(SceneName.CityRadioTower2, { background: 'radio-tower-2-interior.png', up: SceneName.City, upLabel: 'EXIT', collisionMap: 'room_radio_tower2' }); }
}

// ---- Museum: ground floor + four basement levels, each deeper ----
// Each floor uses its own painted collision grid and navigates via painted
// portals (green=up, blue=down, purple=Atlantis sanctum) instead of fixed doors.
export class CityMuseumScene extends CityInteriorScene {
    constructor() { super(SceneName.CityMuseum, { background: 'museum-interior.png', up: SceneName.City, upLabel: 'EXIT', down: SceneName.CityMuseumB1, collisionMap: 'museum_ground' }); }
}
export class CityMuseumB1Scene extends CityInteriorScene {
    // First basement: Hydrogen (was the town lake) and Helium (was Home).
    constructor() { super(SceneName.CityMuseumB1, { background: 'museum-level-1.png', up: SceneName.CityMuseum, upLabel: 'UP', down: SceneName.CityMuseumB2, collisionMap: 'museum_b1', elementIds: ['hydrogen', 'helium'] }); }
}
export class CityMuseumB2Scene extends CityInteriorScene {
    // Second basement: Carbon (was the North Woods), moved down from B1.
    constructor() { super(SceneName.CityMuseumB2, { background: 'museum-level-2.png', up: SceneName.CityMuseumB1, upLabel: 'UP', down: SceneName.CityMuseumB3, collisionMap: 'museum_b2', elementIds: ['carbon'] }); }
}
export class CityMuseumB3Scene extends CityInteriorScene {
    constructor() { super(SceneName.CityMuseumB3, { background: 'museum-level-3.png', up: SceneName.CityMuseumB2, upLabel: 'UP', down: SceneName.CityMuseumB4, collisionMap: 'museum_b3' }); }
}
export class CityMuseumB4Scene extends CityInteriorScene {
    constructor() { super(SceneName.CityMuseumB4, { background: 'museum-level-4.png', up: SceneName.CityMuseumB3, upLabel: 'UP', collisionMap: 'museum_b4' }); }
}

// The hidden Atlantis sanctum — the destination of the key-gated 'custom' tunnel in
// the museum's lowest level (B4). A plain open room showing the "Periodic Table of
// Crystals" art; the Leave button and the EXIT door return to the city. It has no
// public entrance: the only way in is the sanctum portal, which itself only appears
// once the player owns the Magic Key (see createSanctumPortalIfUnlocked).
export class AtlantisScene extends CityInteriorScene {
    // The Giza Crystalline Core sits at the centre of the shrine art. Step onto it to
    // open the Crystalline Resonance puzzle (re-attune the mislabeled crystals).
    private static readonly CORE = { x: 11, y: 5 };

    constructor() { super(SceneName.Atlantis, { background: 'wisdom-of-atlantis.png', up: SceneName.City, upLabel: 'EXIT' }); }

    create(): void {
        super.create();
        const { x, y } = AtlantisScene.CORE;
        drawDoorCue(this, x, y, 'ATTUNE', '✦');
        // Step onto the Core tile at rest (not mid-walk) to open the puzzle. Guarded by
        // inDialogue so it never fires while the overlay is already up.
        const sub = this.gridEngine.movementStopped().subscribe((o) => {
            if (o.charId !== this.playerName) return;
            if (GlobalInfo._gameProgress.inDialogue) return;
            const p = this.gridEngine.getPosition(this.playerName);
            if (p.x === x && p.y === y) openResonanceOverlay();
        });
        this.events.once('shutdown', () => sub.unsubscribe());
    }
}
