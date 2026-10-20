import 'phaser';
import { CollisionStrategy } from 'grid-engine';

import GameScene from './GameScene';
import { LayerType } from './enums/LayerType';
import { Door } from './components/Door';
import { Portal } from './components/Portal';
import { SceneName } from './enums/SceneNames';
import { showLeaveButton, hideLeaveButton } from '../ui/LeaveButton';
import { drawDoorCue } from './components/DoorCue';
import { MAPS } from '../data/maps';
import { INTERIOR_NAV, InteriorFloorNav } from '../data/interiorNav';

// A building interior you reach from the town. The room art is a single Luna
// Town background image; a shared 16x16 collision grid (interior_room.json)
// keeps the dog on the visible white floor. Every interior has an EXIT door
// back to the town, so "there is an exit for each room".
//
// Grid layout (see tools/gen_interior.py): walkable cols 3-11, rows 10-13.
export abstract class InteriorScene extends GameScene {
    private static readonly START = { x: 7, y: 10 };
    private static readonly EXIT = { x: 7, y: 13 };
    private static readonly SPAWN_TILES = [
        { x: 4, y: 11 },
        { x: 10, y: 11 },
        { x: 5, y: 12 },
        { x: 9, y: 12 },
    ];

    private readonly elementIds: string[];
    private readonly backgroundKey: string;
    private readonly backgroundPath: string;
    private bgImage?: Phaser.GameObjects.Image;
    private readonly nav?: InteriorFloorNav;   // set for painted rooms (portal exit)

    constructor(sceneName: SceneName, backgroundFile: string, elementIds: string[], collisionMap?: string) {
        const nav = collisionMap ? INTERIOR_NAV[collisionMap] : undefined;
        const start = nav?.start ?? InteriorScene.START;
        super(sceneName, start.x, start.y, [LayerType.Floor, LayerType.Walls]);
        this.elementIds = elementIds;
        this.nav = nav;
        this.backgroundKey = `${sceneName}_bg`;
        this.backgroundPath = `assets/rooms/${backgroundFile}`;

        this.imageNames = {
            Perli: `${sceneName}_perli`,
            Veterinary: `${sceneName}_veterinary`,
            Map: `${sceneName}_room`,
        };

        // Painted rooms use their own traced collision grid; the rest share the
        // default interior_room open floor.
        const mapKey = collisionMap ?? 'interior_room';
        this.tilemapJSONPath = `assets/tilemap/${mapKey}.json`;
        this.imageMapDefaultPath = 'assets/tiles/';
        this.mapData = MAPS[mapKey];
        this.imageMapNames = {
            blank16: { name: 'blank16' },
        };

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
        this.loadObjectImages();
        this.load.image(this.backgroundKey, this.backgroundPath);
    }

    loadObjectImages(): void {
        this.load.spritesheet(this.imageNames.Veterinary,
            'assets/Characters/NPCs_1.png',
            { frameWidth: 32, frameHeight: 64 });
        this.loadElementalArt(this.elementIds);
    }

    create(): void {
        super.create();

        // The room art, stretched to cover the whole collision grid and sat
        // behind every sprite. Freed when the scene sleeps and reloaded on wake
        // (see addBackground/freeBackground) so visited interiors don't accumulate
        // GPU texture memory — the "page unresponsive" cause on iPad.
        this.addBackground();
        this.events.on('sleep', () => this.freeBackground());
        this.events.on('wake', () => this.reloadBackground());
        this.events.on('shutdown', () => this.freeBackground());

        // Interiors keep the town's fixed camera zoom (see createCamera). The old
        // cover-zoom "filled" the room but over-zoomed it ~50% on tall/portrait
        // screens; any margin around a small room now letterboxes to black.

        // Exit back to the town. Painted rooms use a green exit portal (walk onto
        // it to leave); unpainted rooms keep the fixed centre EXIT door.
        const exitTiles = (this.nav?.portals ?? [])
            .filter(p => p.type === 'ascend').map(p => ({ x: p.x, y: p.y }));
        if (exitTiles.length) {
            new Portal(this, exitTiles, SceneName.Test,
                { color: 0x39d353, symbol: '▲', label: 'EXIT' });
            // Re-entering (wake) leaves the dog on the exit portal it left by; put it
            // back on the safe start tile so it never wakes sitting on a trigger.
            this.events.on('wake', () => {
                try {
                    this.gridEngine.setPosition(this.playerName, this.nav!.start);
                    this.characterMoved = false;
                } catch { /* non-fatal */ }
            });
        } else {
            // The room's walkable floor is above the exit, so the entrance pad is
            // the tile to the north — step onto it to leave. A glowing "EXIT ▼" mat
            // marks the otherwise-invisible pad.
            new Door({
                scene: this, xPosition: InteriorScene.EXIT.x, yPosition: InteriorScene.EXIT.y,
                nextScene: SceneName.Test, entryOffset: { dx: 0, dy: -1 },
            });
            drawDoorCue(this, InteriorScene.EXIT.x, InteriorScene.EXIT.y - 1, 'EXIT', '▼');
        }

        // A one-tap DOM "Leave" button, shown only while inside a building.
        const leave = (): void => this.switch(SceneName.Test);
        showLeaveButton(leave);
        this.events.on('wake', () => showLeaveButton(leave));
        this.events.on('sleep', () => hideLeaveButton());
        this.events.on('shutdown', () => hideLeaveButton());
    }

    createNpcs(): void {
        const tiles = this.nav ? this.walkableSpawnTiles() : InteriorScene.SPAWN_TILES;
        this.elementIds.forEach((id, i) => {
            const tile = tiles[i];
            if (!tile) return;
            this.spawnElemental(id, tile.x, tile.y);
        });
    }

    // For painted rooms: walkable, non-portal tiles that are actually REACHABLE
    // from the start, spaced >=3 apart. The reachability flood-fill is the key fix
    // for Elementals appearing outside the room — painting the collision boundary
    // can leave stray walkable tiles beyond it, and those must never host a monster.
    private walkableSpawnTiles(): { x: number; y: number }[] {
        const portals = new Set((this.nav?.portals ?? []).map(p => `${p.x},${p.y}`));
        const start = this.nav!.start;
        const free = (x: number, y: number): boolean =>
            x >= 0 && y >= 0 && x < this.map.width && y < this.map.height &&
            !this.map.getTileAt(x, y, false, LayerType.Walls);

        const seen = new Set<string>([`${start.x},${start.y}`]);
        const reachable: { x: number; y: number }[] = [];
        const stack = [start];
        while (stack.length) {
            const { x, y } = stack.pop()!;
            const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (let i = 0; i < dirs.length; i++) {
                const nx = x + dirs[i][0], ny = y + dirs[i][1], k = `${nx},${ny}`;
                if (free(nx, ny) && !seen.has(k)) { seen.add(k); reachable.push({ x: nx, y: ny }); stack.push({ x: nx, y: ny }); }
            }
        }

        const chosen: { x: number; y: number }[] = [];
        reachable.forEach(({ x, y }) => {
            if (portals.has(`${x},${y}`)) return;
            if (chosen.every(c => Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) >= 3)) {
                chosen.push({ x, y });
            }
        });
        return chosen;
    }

    // ---- room-background lifecycle (GPU-memory hygiene) ----
    // The room art is a single large image (the biggest asset a room holds). Scenes
    // are never destroyed — switch() sleeps/wakes them — so without this every
    // interior the player has visited would keep its texture resident, growing GPU
    // memory until iOS Safari drops the WebGL context ("page unresponsive"). We free
    // the texture on sleep/shutdown and lazily reload it on wake, so at most the
    // current room's background is resident.
    private addBackground(): void {
        this.bgImage = this.add.image(0, 0, this.backgroundKey)
            .setOrigin(0, 0)
            .setDisplaySize(this.map.widthInPixels, this.map.heightInPixels)
            .setDepth(-100);
    }

    private freeBackground(): void {
        this.bgImage?.destroy();
        this.bgImage = undefined;
        if (this.textures.exists(this.backgroundKey)) this.textures.remove(this.backgroundKey);
    }

    private reloadBackground(): void {
        // Already resident (e.g. a sleep/wake that didn't free it) — just re-add.
        if (this.textures.exists(this.backgroundKey)) { this.addBackground(); return; }
        this.load.image(this.backgroundKey, this.backgroundPath);
        this.load.once(Phaser.Loader.Events.COMPLETE, () => {
            // Guard: the scene may have slept again before the load finished.
            if (this.scene.isActive() && this.textures.exists(this.backgroundKey) && !this.bgImage) this.addBackground();
        });
        this.load.start();
    }

    update(): void {
        super.update();
    }
}
