import 'phaser';
import { CollisionStrategy } from 'grid-engine';

import GameScene from './GameScene';
import { LayerType } from './enums/LayerType';
import { Door } from './components/Door';
import { drawDoorCue } from './components/DoorCue';
import { SceneName } from './enums/SceneNames';
import { MAPS } from '../data/maps';
import GlobalInfo from '../GlobalInfo';
import { playCityReveal } from '../ui/CityReveal';

// The North Woods & Meadow — a natural area reached by following the trail north
// out of town (see the Woods door in TestScene). The whole scene is built from
// modern_exterior tiles by tools/gen_woods.py: tree groves frame the edges, a
// wildflower meadow and walkable tall-grass patches fill the middle, and a
// cobblestone trail runs to the south exit back to town. No NPCs yet — it's here
// to explore (populate with wild Elementals later).
export default class WoodsScene extends GameScene {
    // South exit back to town, and where the player arrives when entering.
    private static readonly EXIT = { x: 20, y: 23 };
    private static readonly START = { x: 20, y: 21 };

    constructor() {
        super(SceneName.Woods, WoodsScene.START.x, WoodsScene.START.y,
            [LayerType.Floor, LayerType.Walls, LayerType.Overhead]);

        this.imageNames = {
            Perli: `${SceneName.Woods}_perli`,
            Veterinary: `${SceneName.Woods}_veterinary`,
            Map: 'woods_map',
        };

        this.tilemapJSONPath = 'assets/tilemap/woods_map.json';
        this.imageMapDefaultPath = 'assets/tiles/';
        this.mapData = MAPS.woods_map;
        this.imageMapNames = {
            modern_exterior: { name: 'modern_exterior' },
        };

        this.gridEngineSettings = {
            startPosition: { ...WoodsScene.START },
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
    }

    // The wild Elementals in the woods — one dedicated spawn tile each (like every
    // other Elemental in the game: fixed, cloaked, found with the Rad Finder). There
    // are NO random tall-grass encounters here anymore; the tall grass is decoration.
    // Carbon moved down into the Museum basement (in the city).
    // Re-scrambled for the official season (2026-10-13): nitrogen took the meadow,
    // neon the eastern tall grass — breaks testers' memorized spots.
    private static readonly WILD: { elementId: string; x: number; y: number }[] = [
        { elementId: 'nitrogen', x: 16, y: 8 },    // up north in the meadow
        { elementId: 'neon',     x: 25, y: 10 },   // by the eastern tall grass
    ];

    // Cainos "Pixel Art Top Down - Basic" props, sliced into src/assets/woods/ by
    // tools/slice_cainos.py. Each scenery object in the tilemap names a KIND; we
    // pick a texture variant, size it in tiles, and set a render depth. Trees sit
    // ABOVE the player (walk-under); ground props sit just below.
    private static readonly CHAR_DEPTH = 10;                     // grid-engine chars
    private static readonly OVERHEAD_DEPTH = WoodsScene.CHAR_DEPTH + 10;
    private static readonly GROUND_DEPTH = WoodsScene.CHAR_DEPTH - 4;
    private static readonly SCENERY: Record<string,
        { keys: string[]; tilesW: number; depth: number }> = {
        tree:     { keys: ['woods_tree_1', 'woods_tree_2', 'woods_tree_3'], tilesW: 2,   depth: WoodsScene.OVERHEAD_DEPTH },
        rock:     { keys: ['woods_rock_1'],                                 tilesW: 1.4, depth: WoodsScene.GROUND_DEPTH },
        bush:     { keys: ['woods_bush_3', 'woods_bush_4', 'woods_bush_6'], tilesW: 1.1, depth: WoodsScene.GROUND_DEPTH },
        grass:    { keys: ['woods_grass_3'],                                tilesW: 1,   depth: WoodsScene.GROUND_DEPTH - 1 },
    };

    loadObjectImages(): void {
        this.loadElementalArt(WoodsScene.WILD.map(w => w.elementId));
        // Scenery sprites (unique texture keys across all SCENERY kinds).
        const files: Record<string, string> = {
            woods_tree_1: 'tree-1', woods_tree_2: 'tree-2', woods_tree_3: 'tree-3',
            woods_rock_1: 'rock-1', woods_bush_3: 'bush-3', woods_bush_4: 'bush-4',
            woods_bush_6: 'bush-6', woods_grass_3: 'grass-3',
            woods_chest: 'treasure-chest',   // forest treasure chest (holds the Magic Key)
        };
        Object.entries(files).forEach(([key, file]) =>
            this.load.image(key, `assets/woods/${file}.png`));
    }

    // Drop the Cainos scenery sprites listed in the tilemap's `scenery` object
    // layer. Base is anchored to the object point (bottom-centre); width is set in
    // tiles so art scales consistently; depth decides over/under the player.
    placeScenery(): void {
        const layer = this.map.getObjectLayer('scenery');
        if (!layer) return;
        layer.objects.forEach((obj, idx) => {
            const spec = WoodsScene.SCENERY[obj.name ?? ''];
            if (!spec || obj.x == null || obj.y == null) return;
            const props: Record<string, unknown> = {};
            (obj.properties as { name: string; value: unknown }[] | undefined)
                ?.forEach(p => { props[p.name] = p.value; });
            const variant = (typeof props.variant === 'number' ? props.variant - 1 : idx)
                % spec.keys.length;
            const tilesW = typeof props.tw === 'number' ? props.tw : spec.tilesW;
            const img = this.add.image(obj.x, obj.y, spec.keys[variant]).setOrigin(0.5, 1);
            img.setScale((tilesW * this.map.tileWidth) / img.width);
            img.setDepth(spec.depth);
        });
    }

    create(): void {
        super.create();

        // The RULE: canopy tiles live on the `overhead` layer — lift it above the
        // character depth so the player walks UNDER the trees, then drop the
        // Cainos tree/prop sprites in on top.
        this.map.getLayer(LayerType.Overhead)?.tilemapLayer
            ?.setDepth(WoodsScene.OVERHEAD_DEPTH);
        this.placeScenery();

        // Trail back to town at the south edge; the walkable meadow is to the
        // north, so the entrance pad is the tile to the north (approach from
        // above and step onto it to leave). A glowing "TOWN ▼" pad marks it.
        new Door({
            scene: this, xPosition: WoodsScene.EXIT.x, yPosition: WoodsScene.EXIT.y,
            nextScene: SceneName.Test, entryOffset: { dx: 0, dy: -1 },
        });
        drawDoorCue(this, WoodsScene.EXIT.x, WoodsScene.EXIT.y - 1, 'TOWN', '▼');

        // (No random tall-grass encounters — each wild Elemental has its own
        // dedicated spawn tile in createNpcs, found with the Rad Finder.)

        // Lookout: walk up the corridor (column 20) to the very top of the woods to
        // trigger the city-reveal cutscene. A faint "LOOKOUT ▲" marker makes the
        // path discoverable instead of a pixel-hunt (~a third of the Elementals live
        // in the city beyond it); the Rad Finder also points here when a city
        // Elemental is tracked.
        drawDoorCue(this, 20, 1, 'LOOKOUT', '▲');
        const cityReveal = this.gridEngine.movementStopped().subscribe((o) => {
            if (o.charId !== this.playerName) return;
            if (GlobalInfo._gameProgress.inDialogue) return;
            const p = this.gridEngine.getPosition(this.playerName);
            if (p.x === 20 && p.y <= 1) playCityReveal(() => this.switch(SceneName.City));
        });
        this.events.once('shutdown', () => cityReveal.unsubscribe());
    }

    createNpcs(): void {
        // Wild Elementals roaming the meadow — walk up to any to start its quiz.
        WoodsScene.WILD.forEach(w => this.spawnElemental(w.elementId, w.x, w.y));
        // A treasure chest hidden off to the side — a tree-framed nook on the far
        // eastern edge of the woods, well off the central trail. Walk up to it to
        // claim the mysterious key.
        this.spawnTreasureChest(37, 13);
    }

    update(): void {
        super.update();
    }
}
