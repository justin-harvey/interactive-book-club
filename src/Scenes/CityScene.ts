import 'phaser';
import { CollisionStrategy } from 'grid-engine';

import GameScene from './GameScene';
import { LayerType } from './enums/LayerType';
import { Door } from './components/Door';
import { drawDoorCue } from './components/DoorCue';
import { SceneName } from './enums/SceneNames';
import { MAPS } from '../data/maps';

// The walkable City across the bridge — reached from the woods lookout via the
// city-reveal cutscene. Paved streets with the nine city buildings laid out in
// three rows: overlay art over invisible collision footprints, the same pattern
// as the town. Each building is enterable via a door on its front (see
// INTERIORS + CityInteriors.ts); the museum opens into a chain of basement
// levels. A glowing "WOODS ▼" pad at the bottom returns you to the woods.
//
// Keep BUILDINGS in sync with tools/gen_city.py PLACEMENTS (the collision
// footprints in city_map.json are generated from the same numbers).
const BUILDINGS: { id: string; centerCol: number; baseRow: number; widthTiles: number }[] = [
    { id: 'power-tower',      centerCol: 12, baseRow: 24, widthTiles: 10.0 },
    { id: 'finance-tower',    centerCol: 28, baseRow: 24, widthTiles: 10.0 },
    { id: 'large-tower',      centerCol: 44, baseRow: 24, widthTiles: 6.0 },
    { id: 'museum',           centerCol: 12, baseRow: 50, widthTiles: 10.0 },
    { id: 'large-church',     centerCol: 28, baseRow: 50, widthTiles: 11.0 },
    { id: 'fashion-district', centerCol: 44, baseRow: 50, widthTiles: 10.0 },
    { id: 'radio-tower',      centerCol: 12, baseRow: 66, widthTiles: 3.5 },
    { id: 'power-station',    centerCol: 28, baseRow: 66, widthTiles: 16.0 },
    { id: 'radio-tower-2',    centerCol: 44, baseRow: 66, widthTiles: 3.5 },
];

// Which interior scene each building opens into. The museum leads to a chain of
// basement levels (see CityInteriors.ts).
const INTERIORS: Record<string, SceneName> = {
    'power-tower':      SceneName.CityPowerTower,
    'finance-tower':    SceneName.CityFinance,
    'large-tower':      SceneName.CityLargeTower,
    'museum':           SceneName.CityMuseum,
    'large-church':     SceneName.CityChurch,
    'fashion-district': SceneName.CityFashion,
    'radio-tower':      SceneName.CityRadioTower,
    'power-station':    SceneName.CityPowerStation,
    'radio-tower-2':    SceneName.CityRadioTower2,
};

// Elementals relocated out of the town interiors (one monster per interior now) —
// they roam the city streets instead of crowding a room. Each tile is a
// guaranteed-walkable open avenue cell (empty walls layer), clear of buildings,
// doors, props and pedestrians.
const CITY_ELEMENTALS: [string, number, number][] = [
    ['aluminum', 6, 28], ['fluorine', 36, 40], ['scandium', 6, 44],
    ['boron', 46, 58], ['beryllium', 16, 60], ['sulfur', 36, 60],
    // First-row transition metals (2026-10). Tiles validated 3x3-clear against the
    // walls layer of city_map.json, spaced from the others, buildings and the exit.
    ['titanium', 4, 12], ['vanadium', 34, 16], ['chromium', 18, 20],
    ['manganese', 18, 30], ['cobalt', 18, 40], ['nickel', 18, 50],
    // Period-4 post-transition metals / metalloids / noble gas + period-5 alkali
    // (2026-10-09). Tiles flood-fill-reachable from START and 3x3-clear against the
    // walls layer, spread across the city and ≥3 tiles from every other elemental.
    ['zinc', 4, 2], ['gallium', 34, 2], ['germanium', 19, 4], ['arsenic', 49, 4],
    ['selenium', 49, 23], ['bromine', 36, 28], ['krypton', 2, 59], ['rubidium', 49, 69],
    // Second-row (4d) transition metals (2026-10-09 batch 2). Tiles flood-fill-reachable
    // from START and 3x3-clear against the walls layer, ≥3 tiles from every other elemental.
    ['zirconium', 18, 12], ['niobium', 46, 13], ['molybdenum', 2, 36], ['technetium', 35, 50],
    ['ruthenium', 5, 69], ['rhodium', 14, 69], ['palladium', 39, 69],
];

export default class CityScene extends GameScene {
    private static readonly START = { x: 24, y: 70 };
    private static readonly EXIT = { x: 30, y: 71 };

    constructor() {
        super(SceneName.City, CityScene.START.x, CityScene.START.y, [LayerType.Floor, LayerType.Walls]);

        this.imageNames = {
            Perli: `${SceneName.City}_perli`,
            Veterinary: `${SceneName.City}_veterinary`,
            Map: 'city_map',
        };
        this.tilemapJSONPath = 'assets/tilemap/city_map.json';
        this.mapData = MAPS.city_map;
        this.imageMapDefaultPath = 'assets/tiles/';
        this.imageMapNames = { modern_exterior: { name: 'modern_exterior' } };

        this.gridEngineSettings = {
            startPosition: { ...CityScene.START },
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

    loadObjectImages(): void {
        BUILDINGS.forEach(b => this.load.image(`city_${b.id}`, `assets/city/${b.id}.png`));
        // Human pedestrian sprites (grid-engine standard 3x4 layout per person).
        this.load.spritesheet(this.imageNames.Veterinary, 'assets/Characters/NPCs_1.png',
            { frameWidth: 32, frameHeight: 64 });
        // Plaza props.
        this.load.image('city_lamp', 'assets/city/lamp.png');
        this.load.image('city_bench', 'assets/city/bench.png');
        // Art for the Elementals now roaming the city.
        this.loadElementalArt(CITY_ELEMENTALS.map(e => e[0]));
    }

    create(): void {
        super.create();
        // The city is a large map, so pull the camera back from the town's default
        // 2.5 to show more of it — it felt too close at the shared zoom.
        this.cameras.main.setZoom(1.8);

        // Real building art over the invisible collision footprints.
        BUILDINGS.forEach(b => this.drawBuilding(b));

        // A door on each building's front (its base row); step onto the walkable
        // road tile just south of it to go inside. A glowing "ENTER ▲" pad marks
        // each entrance, matching the town.
        BUILDINGS.forEach(b => {
            new Door({
                scene: this, xPosition: b.centerCol, yPosition: b.baseRow,
                nextScene: INTERIORS[b.id],
            });
            drawDoorCue(this, b.centerCol, b.baseRow + 1, 'ENTER', '▲');
        });

        // Plaza dressing: lit lamps (glow at dusk) + benches around the centre.
        this.drawProp('city_lamp', 26, 56, 1.4);
        this.drawProp('city_lamp', 31, 56, 1.4);
        this.drawProp('city_bench', 26, 57, 1.8);
        this.drawProp('city_bench', 31, 57, 1.8);

        // Street lamps dotted along the avenues (decorative — no collision).
        [[4, 30], [49, 30], [4, 55], [49, 55], [20, 40], [35, 40], [20, 62], [35, 62]]
            .forEach(([c, r]) => this.drawProp('city_lamp', c, r, 1.3));

        // Way back to the woods lookout (step onto the pad from the north).
        new Door({
            scene: this, xPosition: CityScene.EXIT.x, yPosition: CityScene.EXIT.y,
            nextScene: SceneName.Woods, entryOffset: { dx: 0, dy: -1 },
        });
        drawDoorCue(this, CityScene.EXIT.x, CityScene.EXIT.y - 1, 'WOODS', '▼');

        // Trail out to the jungle (level 2), on the south edge west of the woods pad.
        // Progression is City → Jungle → Desert; the desert finale is reached THROUGH
        // the jungle (its north pad), so the city links to the jungle, not the desert.
        new Door({
            scene: this, xPosition: 18, yPosition: 71,
            nextScene: SceneName.Jungle, entryOffset: { dx: 0, dy: -1 },
        });
        drawDoorCue(this, 18, 70, 'JUNGLE', '▼');
    }

    // Overlay one building: anchored bottom-centre on its base row and scaled so
    // the art spans `widthTiles` tiles (aspect preserved). Depth 1 keeps it above
    // the ground but below the dog (depth 10), so the dog walks in front.
    private drawBuilding(b: { id: string; centerCol: number; baseRow: number; widthTiles: number }): void {
        const key = `city_${b.id}`;
        const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
        const scale = (b.widthTiles * 16) / src.width;
        this.add.image((b.centerCol + 0.5) * 16, (b.baseRow + 1) * 16, key)
            .setOrigin(0.5, 1)
            .setScale(scale)
            .setDepth(1);
    }

    // A decorative prop (lamp, bench…) anchored bottom-centre on a tile, scaled
    // to `tilesWide`. Depth 1 like buildings, so the dog walks in front.
    private drawProp(key: string, col: number, row: number, tilesWide: number): void {
        const src = this.textures.get(key).getSourceImage() as HTMLImageElement;
        const scale = (tilesWide * 16) / src.width;
        this.add.image((col + 0.5) * 16, (row + 1) * 16, key)
            .setOrigin(0.5, 1)
            .setScale(scale)
            .setDepth(1);
    }

    createNpcs(): void {
        // Pedestrians wandering the streets + plaza — (charIndex, col, row). All
        // on clearly walkable tiles (roads / open plaza) so they roam freely.
        const people: [number, number, number][] = [
            [0, 8, 26], [1, 44, 26],   // top avenue
            [2, 8, 52], [3, 44, 52],   // middle avenue
            [4, 24, 56], [5, 32, 56],  // plaza
            [6, 10, 69], [7, 42, 69],  // south avenue
        ];
        people.forEach(([i, x, y]) => this.spawnPedestrian(i, x, y));

        // A few characters who say hello when you walk up to them.
        this.spawnTalkingNpc(1, 28, 52, 'City Guide', [
            'Welcome to the city! It grew from every element you catch.',
            'Have a wander — there is more to come here soon.',
        ]);
        this.spawnTalkingNpc(3, 14, 54, 'Professor', [
            'Look around: concrete, steel, glass, neon…',
            'Every bit of this city is chemistry at work!',
        ]);
        this.spawnTalkingNpc(5, 40, 54, 'City Kid', [
            'Whoa, a dog downtown!',
            'Did you see the towers? They are HUGE.',
        ]);

        // Elementals relocated from the town interiors now roam the streets. Walk
        // up to one to start its quiz (proximity trigger, same as everywhere).
        CITY_ELEMENTALS.forEach(([id, x, y]) => this.spawnElemental(id, x, y));
    }

    update(): void {
        super.update();
    }
}
