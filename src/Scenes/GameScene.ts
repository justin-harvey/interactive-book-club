import { LayerType } from './enums/LayerType';
import { Tilemaps } from 'phaser'
import { createMap } from './components/TileMap'
import { NpcsAndObjects, createCharacterSprite } from './components/NpcAndObjects'
import GlobalInfo from '../GlobalInfo'
import { GridEngine, Position, Direction, CollisionStrategy } from 'grid-engine'
import { basicMovement, clickToMove } from './components/Characters'
import { Npc } from './components/Npc'
import { cloakElemental } from './components/Cloak'
import { getElement, ELEMENTS } from '../data/elements'
import { statusOf, giveItem, hasItem, MAGIC_KEY } from '../data/progress'
import { elementalArtKey, elementalArtPath } from '../data/elementalArt'
import { elementReleased } from '../data/classConfig'
import { elementalLocation } from '../data/elementalLocations'
import { startBattle } from '../ui/QuizOverlay'
import { showNpcDialog } from '../ui/NpcDialog'
import { attachPresence } from '../net/ScenePresence'
import { isRadFinderEquipped, getRadTarget, setRadReading } from '../ui/RadFinder'
import { getCharacter, textureKeyFor, loadCharacterSheets, faceFlip, type CharacterDef, type WalkMap } from '../data/characters'
import { getGuestCharacter, getGuestColor, colorToInt } from '../net/identity'

// Real Elemental art is a big single image; this scale reads it down to roughly
// character size on the grid (the placeholder NPC spritesheet uses ~0.7).
const ELEMENTAL_ART_SCALE = 0.05

// Treasure-chest art is small pixel art (32x31); scale it UP to sit a little
// under Elemental size (which is 1024px * 0.05 ≈ 51px). ~45px reads as a tappable
// woods prop. Tune this one value if the chest looks too big/small on device.
const CHEST_ART_SCALE = 0.7

export default abstract class GameScene extends Phaser.Scene {

    // Grid Engine info
    gridEngine!: GridEngine;
    gridEngineSettings: {
        startPosition: {
            x: number;
            y: number;
        };
        scale: number;
        characterCollisionStrategy: CollisionStrategy;
        layerOverlay: boolean;
    };

    // direction keys
    cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

    // action keys to use main player habilities
    keyA: Phaser.Input.Keyboard.Key;
    keyS: Phaser.Input.Keyboard.Key;
    keyD: Phaser.Input.Keyboard.Key;
    keyR: Phaser.Input.Keyboard.Key;
    keyF!: Phaser.Input.Keyboard.Key;

    // menu keys
    backKey!: Phaser.Input.Keyboard.Key;

    // main player
    playerSprite!: Phaser.Physics.Arcade.Sprite;
    playerName!: string;
    avatarScale: number = 0.15;
    playerCharacter!: CharacterDef;      // the chosen avatar character
    flying = false;                      // birds only: flight toggled with F
    private appliedLook = '';            // last applied "<characterId>|<colour>|<fly>" signature

    // action sounds
    bark: Phaser.Sound.BaseSound;
    sniff: Phaser.Sound.BaseSound;
    dogMeme!: Phaser.Sound.BaseSound;   // "what da dog doin" easter-egg sting
    private dogComboCount = 0;
    private dogComboLast = 0;
    private dogComboKey: 'S' | 'D' | null = null;   // last key, for strict S/D alternation

    sceneName!: string;
    map!: Tilemaps.Tilemap;
    npcsAndObjectsArray: NpcsAndObjects[] = [];
    characterMoved: boolean = false;

    // Rad Finder: fixed-position Elementals spawned in this scene (release-gated),
    // and the last player tile we computed a reading for (so update() only
    // recomputes on a tile change, not every frame).
    elementalTargets: { elementId: string; x: number; y: number }[] = [];
    private rfLastMs = 0;

    // to load images
    imageNames!: {
        Map: string, //map is mandatory for the scene
        [index: string]: string
    };
    imageMapDefaultPath: string;
    tilemapJSONPath!: string;
    // Embedded Tiled map data (set by scenes from src/data/maps.ts). When set, the
    // map loads from here instead of an XHR fetch, so the game runs offline from a
    // plain file:// (double-click) with no web server.
    mapData?: object;
    layerNames: LayerType[];
    imageMapNames!: {
        [index: string]: {
            name: string;
            path?: string;
        };
    };

    constructor(
        name: string,
        xPos?: number,
        yPos?: number,
        layerNames?: LayerType[]) {
        super(name);
        this.sceneName = name
        this.playerName = `${name}_perli`
        this.imageMapDefaultPath = 'tilesets/'
        this.layerNames = layerNames || Object.values(LayerType)
        this.gridEngineSettings = {
            startPosition: {
                x: xPos ?? 1,
                y: yPos ?? 1
            },
            scale: 1,
            characterCollisionStrategy: CollisionStrategy.BLOCK_ONE_TILE_AHEAD,
            layerOverlay: false
        }
    }

    // load here images and sounds common in all scenes
    preload(): void {
        this.load.image('emptyDoorGraphic', 'assets/images/emptyDoorGraphic.png')
        this.load.audio('bark', 'assets/music/bark.wav');
        this.load.audio('sniff', 'assets/music/sniffing.wav');
        this.load.audio('whatDaDogDoin', 'assets/music/what-da-dog-doin.mp3');
    }

    create(): void {
        // asign logic to keys
        this.cursors = this.input.keyboard.createCursorKeys()
        this.backKey = this.input.keyboard.addKey('ESC')
        this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.keyF = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);

        // add sounds
        this.bark = this.sound.add('bark', { loop: false });
        this.sniff = this.sound.add('sniff', { loop: false });
        this.dogMeme = this.sound.add('whatDaDogDoin', { loop: false });

        //add special animations for actions from main player
        createSpecialAnimations(this)

        // create map, npcs, objects and start grid engine
        this.createMap();
        this.initiateGridEngine();
        this.createCamera(this.map.widthInPixels, this.map.heightInPixels);
        // Scenes are reused across switch/restart, so clear last run's targets
        // before createNpcs() (which calls spawnElemental) repopulates them.
        this.elementalTargets = [];
        this.rfLastMs = 0;
        this.createNpcs();
        basicMovement(this);
        clickToMove(this);
        NpcsAndObjects.interaction(this)

        // stop animations like bark or sniff when player starts to move
        this.gridEngine.movementStarted().subscribe(() => {
            this.playerSprite.anims.stop();
        });

        // iOS Safari blocks audio until a user gesture — unlock on the first tap
        // so the bark/sniff sounds actually play on an iPad. (NoAudioSoundManager
        // has no unlock(), hence the guard.)
        this.input.once('pointerdown', () => {
            const sm = this.sound as unknown as { locked?: boolean; unlock?: () => void };
            if (sm.locked && typeof sm.unlock === 'function') sm.unlock();
        });

        // Real-time presence: publish this player's movement and show other members
        // in the same scene. Scoped per scene (town vs each interior). No-op solo if
        // the presence server is unreachable.
        attachPresence(this);
    }

    // Easter egg: strictly ALTERNATING the dog's "sit"/"sniff" keys — S,D,S,D,…
    // (sdsdsdsdsd) — ten presses in quick succession (within ~2s between presses)
    // plays the "what da dog doin" sting. Pressing the same key twice in a row
    // breaks the alternation and restarts the streak from that press.
    private static readonly DOG_COMBO_TARGET = 10;
    private registerDogAction(key: 'S' | 'D'): void {
        const now = this.time.now;
        const timedOut = now - this.dogComboLast > 2000;
        this.dogComboLast = now;
        if (timedOut || this.dogComboKey === null || key === this.dogComboKey) {
            // first press, too slow, or a repeat of the same key — start over at 1
            this.dogComboCount = 1;
        } else {
            // alternated from the previous key — extend the streak
            this.dogComboCount++;
        }
        this.dogComboKey = key;
        if (this.dogComboCount >= GameScene.DOG_COMBO_TARGET) {
            this.dogComboCount = 0;
            this.dogComboKey = null;
            this.dogMeme?.play();
        }
    }

    update(): void {
        this.refreshRadFinder();

        // Mirror 3-direction characters (hamster/birds) for the 'right' facing. Done every
        // frame from the current facing — grid-engine's directionChanged doesn't fire during
        // moveTo, so this is the reliable hook. No-op for 4-direction characters.
        if (this.playerCharacter?.mirror) {
            faceFlip(this.playerSprite, this.playerCharacter, this.gridEngine.getFacingDirection(this.playerName) as unknown as string);
        }

        // F toggles flight for birds (take off / land).
        if (this.keyF && Phaser.Input.Keyboard.JustDown(this.keyF)) {
            this.toggleFlight();
        }

        // Keep a flying bird's wings beating even while it hovers in place.
        this.updateFlightFlap();

        // Dog-only actions (bark/sit/sniff). These animations live on the Perli sheet, so
        // they only apply when the player's character is the dog; pixel townsfolk skip them.
        if (Phaser.Input.Keyboard.JustDown(this.keyA) && this.playerCharacter?.special) {
            this.bark.play();
            this.gridEngine.getFacingDirection(this.playerName) === "right"
                ? this.playerSprite.anims.play("barkingRight", true)
                : this.playerSprite.anims.play("barking", true);
        };

        if (Phaser.Input.Keyboard.JustDown(this.keyS) && this.playerCharacter?.special) {
            this.gridEngine.getFacingDirection(this.playerName) === "right"
                ? this.playerSprite.anims.play("sitRight", true)
                : this.playerSprite.anims.play("sit", true);
            this.registerDogAction('S');
        };

        if (Phaser.Input.Keyboard.JustDown(this.keyD) && this.playerCharacter?.special) {
            this.sniff.play();
            this.gridEngine.getFacingDirection(this.playerName) === "right"
                ? this.playerSprite.anims.play("sniffRight", true)
                : this.playerSprite.anims.play("sniff", true);
            this.registerDogAction('D');
        };

        // TODO: fix this to keep player running
        if (Phaser.Input.Keyboard.JustDown(this.keyR)) {
            this.gridEngine.setSpeed(this.playerName, 7);
        }

        if (Phaser.Input.Keyboard.JustUp(this.keyR)) {
            this.gridEngine.setSpeed(this.playerName, 4)
        };
    }

    // Degrees to rotate the up-pointing arrow so it points from the player toward a
    // tile delta (east +x, south +y in grid coords). 0 = north, clockwise-positive.
    private angleTo(dx: number, dy: number): number {
        return (dx === 0 && dy === 0) ? 0 : Math.atan2(dx, -dy) * 180 / Math.PI
    }

    // Rad Finder reading for the current room. Points an arrow at the Elemental the
    // student picked in the DEX (getRadTarget): in this room → the arrow rotates
    // toward it and heats up as they approach; elsewhere → show its location hint;
    // caught → say so. With nothing picked, fall back to the nearest uncaught here.
    // Throttled to ~4 readings/sec to keep the DOM writes cheap.
    refreshRadFinder(): void {
        if (!isRadFinderEquipped() || !this.gridEngine) return
        const now = performance.now()
        if (now - this.rfLastMs < 250) return
        this.rfLastMs = now
        const p = this.gridEngine.getPosition(this.playerName)

        const targetId = getRadTarget()
        if (targetId) {
            const el = getElement(targetId)
            // Don't reveal an undiscovered creature's name in the HUD.
            const name = (el && statusOf(targetId) !== 'unseen') ? el.monster : 'your target'
            if (statusOf(targetId) === 'caught') {
                setRadReading({ mode: 'caught', label: `${name} caught!`, detail: 'Pick another in the DEX.', heat: 'none' })
                return
            }
            const here = this.elementalTargets.find(t => t.elementId === targetId)
            if (here) {
                const dx = here.x - p.x, dy = here.y - p.y
                const d = Math.max(Math.abs(dx), Math.abs(dy))
                setRadReading({
                    mode: 'homing',
                    label: `Tracking ${name}`,
                    detail: d <= 1 ? 'RIGHT HERE!' : `${d} tiles away`,
                    angleDeg: this.angleTo(dx, dy),
                    heat: d <= 1 ? 'hot' : d <= 3 ? 'warm' : 'cool',
                })
            } else {
                setRadReading({
                    mode: 'elsewhere',
                    label: `Tracking ${name}`,
                    detail: `Head to: ${elementalLocation(targetId)}`,
                    heat: 'none',
                })
            }
            return
        }

        // Nothing picked: home on the nearest uncaught, released Elemental in the room.
        const live = this.elementalTargets.filter(t => statusOf(t.elementId) !== 'caught')
        let nearest: { d: number; dx: number; dy: number; id: string } | null = null
        for (const t of live) {
            const dx = t.x - p.x, dy = t.y - p.y
            const d = Math.max(Math.abs(dx), Math.abs(dy))   // Chebyshev tiles
            if (!nearest || d < nearest.d) nearest = { d, dx, dy, id: t.elementId }
        }
        if (!nearest) {
            const totalUndiscovered = ELEMENTS.filter(
                e => elementReleased(e.id) && statusOf(e.id) !== 'caught').length
            setRadReading({
                mode: 'none',
                label: 'Rad Finder',
                detail: totalUndiscovered > 0 ? 'No signal here — try another area.' : 'All Elementals found!',
                heat: 'none',
            })
            return
        }
        const nm = getElement(nearest.id)
        const nmName = (nm && statusOf(nearest.id) !== 'unseen') ? `Nearest: ${nm.monster}` : 'Nearest signal'
        setRadReading({
            mode: 'homing',
            label: nmName,
            detail: nearest.d <= 1 ? 'RIGHT HERE!' : `${nearest.d} tiles · pick one in the DEX`,
            angleDeg: this.angleTo(nearest.dx, nearest.dy),
            heat: nearest.d <= 1 ? 'hot' : nearest.d <= 3 ? 'warm' : 'cool',
        })
    }

    // used in scenes to load objects images
    abstract loadObjectImages(): void

    // used by scenes to create NPCS
    abstract createNpcs(): void

    /** Not a standard method of Phaser.Scene.
     * Resets the scene completely.
     * Needed because of own implementations like the npcsAndObjectsArray.
     */
    reset(
        /** If set to true, the position and orientation of the player character will be kept. */
        keepCharacterPosition: boolean = true,
    ): void {
        const oldPosition: Position = this.gridEngine.getPosition(this.playerName)
        const oldDirection: Direction = this.gridEngine.getFacingDirection(this.playerName)

        this.npcsAndObjectsArray = []
        this.gridEngine.removeAllCharacters()
        this.scene.restart()
        /* updates scene manager to restart immediately
           (always restarts with next scene manager update)
          */
        this.scene.manager.update(0, 0)
        if (keepCharacterPosition) {
            this.gridEngine.setPosition(this.playerName, oldPosition)
            this.gridEngine.turnTowards(this.playerName, oldDirection)
        }
    }

    // load the main character
    loadAvatarSpritesheet(): void {
        this.load.spritesheet(this.imageNames.Perli,
            'assets/Characters/Perli.png',
            { frameWidth: 198, frameHeight: 188 }
        );
        // Also load the selectable pixel townsfolk (idempotent across scene preloads).
        loadCharacterSheets(this);
    }

    // Queue the real art PNGs for the given Elementals (skips ones with no art
    // and ones already cached). Call from a scene's loadObjectImages().
    loadElementalArt(elementIds: string[]): void {
        elementIds.forEach(id => {
            const key = elementalArtKey(id)
            if (key && !this.textures.exists(key)) {
                this.load.image(key, elementalArtPath(id))
            }
        })
    }

    // Spawn one Elemental at a tile: real character art if it has any, otherwise
    // the tinted placeholder NPC. Walking within one tile opens its quiz
    // automatically (no key press — see NpcsAndObjects proximity logic). No
    // floating label — the art speaks for itself (labels broke immersion).
    spawnElemental(elementId: string, x: number, y: number): void {
        // BOOKCLUB M1: lesson layer neutralized — no Elementals/quizzes spawn, so the
        // world is a peaceful walkable space. Scenes still call this via createNpcs();
        // this early return makes every such call a no-op. Reversible: delete this line.
        return
        const element = getElement(elementId)
        if (!element) return
        if (!elementReleased(elementId)) return   // hidden until its release day
        const artKey = elementalArtKey(elementId)

        const npc = new Npc({
            scene: this,
            xPosition: x,
            yPosition: y,
            texture: artKey ?? this.imageNames.Veterinary,
            scale: artKey ? ELEMENTAL_ART_SCALE : 0.7,
            tint: artKey ? undefined : element.tint,
            action: () => { startBattle(elementId) },
            // Real art is a single frame → no walking animation mapping.
            walkingAnimationMapping: artKey ? undefined : 0,
        })
        // Open the quiz on proximity rather than on an interact key.
        npc.proximityTrigger = true
        // Register as a Rad Finder target so the tool can home in on it.
        this.elementalTargets.push({ elementId, x, y })
        // Cloak it: rendered very faint so it's hard to spot by eye — the Rad Finder
        // is the way to find it (walking within a tile still auto-triggers the quiz).
        const sprite = this.gridEngine.getSprite(npc.name)
        if (sprite) cloakElemental(sprite)
    }

    // A flavor NPC with real art that just wanders the map — no quiz, no plot.
    // Used for Neonu Reeves, the disco bug who simply exists. Single-frame art,
    // so no walking-animation mapping (see Npc.addCharacter).
    spawnWanderingNpc(textureKey: string, x: number, y: number): void {
        const npc = new Npc({
            scene: this,
            xPosition: x,
            yPosition: y,
            texture: textureKey,
            scale: ELEMENTAL_ART_SCALE,
        })
        // delay(ms) between hops, wandering within `radius` tiles of the start.
        this.gridEngine.moveRandomly(npc.name, 2000, 2)
    }

    // A city pedestrian: a human character from the NPC sheet (grid-engine's
    // standard 3x4 layout — `charIndex` picks which person) who wanders the
    // nearby streets. grid-engine's random movement respects collision, so they
    // keep to the pavement and never walk through buildings.
    spawnPedestrian(charIndex: number, x: number, y: number, radius: number = 3): void {
        const npc = new Npc({
            scene: this,
            xPosition: x,
            yPosition: y,
            texture: this.imageNames.Veterinary,
            scale: 0.35,
            walkingAnimationMapping: charIndex,
        })
        this.gridEngine.moveRandomly(npc.name, 1500, radius)
    }

    // A stationary city character who says a line or two when the player walks up
    // (proximity), then re-arms once they step away. Reuses the NPC dialog box.
    spawnTalkingNpc(charIndex: number, x: number, y: number, speaker: string, lines: string[]): void {
        const npc = new Npc({
            scene: this,
            xPosition: x,
            yPosition: y,
            texture: this.imageNames.Veterinary,
            scale: 0.35,
            walkingAnimationMapping: charIndex,
            action: () => {
                npc.proximityTrigger = false
                showNpcDialog(speaker, lines, () => { npc.proximityTrigger = true })
            },
        })
        npc.proximityTrigger = true
    }

    // A companion NPC: walk up to it to trigger a one-time dialog, after which it
    // becomes a follower that trails the player around the scene. Used for Neonu
    // Reeves in the woods. Single-frame art → no walking-animation mapping.
    spawnCompanionNpc(textureKey: string, x: number, y: number, speaker: string, lines: string[]): void {
        const npc = new Npc({
            scene: this,
            xPosition: x,
            yPosition: y,
            texture: textureKey,
            scale: ELEMENTAL_ART_SCALE,
            action: () => {
                // Talk once, then befriend: disarm the proximity trigger so the
                // dialog can't re-fire while he's tagging along.
                npc.proximityTrigger = false
                showNpcDialog(speaker, lines, () => {
                    this.gridEngine.follow(npc.name, this.playerName, 1, true)
                })
            },
        })
        // Walk within one tile to start the dialog (same as an Elemental).
        npc.proximityTrigger = true
    }

    // A treasure chest you walk up to (proximity, like an Elemental) to open a
    // dialog. The first time, it reveals the Magic Key and persists it via
    // giveItem(MAGIC_KEY) so it survives reloads — that flag gates the hidden tunnel
    // in the Museum's lowest level (B4) that opens to the Atlantis sanctum (see
    // CityInteriors.createSanctumPortalIfUnlocked). After looting it reads as empty.
    // The chest sprite is small pixel art loaded as `woods_chest`. Drop in an
    // `assets/woods/treasure-chest-open.png` (texture key `woods_chest_open`) and
    // it swaps to the opened art once looted — no code change needed.
    spawnTreasureChest(x: number, y: number): void {
        const OPEN = 'woods_chest_open'
        const looted = (): boolean => hasItem(MAGIC_KEY)
        const openTexture = (): string => this.textures.exists(OPEN) ? OPEN : 'woods_chest'

        const npc = new Npc({
            scene: this,
            xPosition: x,
            yPosition: y,
            texture: looted() ? openTexture() : 'woods_chest',
            scale: CHEST_ART_SCALE,
            action: () => {
                npc.proximityTrigger = false
                if (looted()) {
                    showNpcDialog('Treasure Chest',
                        ['The old chest lies open and empty.'],
                        () => { npc.proximityTrigger = true })
                    return
                }
                showNpcDialog('Treasure Chest', [
                    'A weathered chest is half-buried in the ferns. With a groan, the lid creaks open…',
                    'Inside lies a mysterious key — etched with elements and a bubbling flask. Legend says it opens a tunnel sealed deep beneath the Museum…',
                ], () => {
                    giveItem(MAGIC_KEY)
                    const sprite = this.gridEngine.getSprite(npc.name)
                    if (sprite && this.textures.exists(OPEN)) sprite.setTexture(OPEN)
                    npc.proximityTrigger = true
                }, { image: 'assets/items/magic-key.png' })
            },
        })
        // Walk within one tile to open it (same proximity trigger as an Elemental).
        npc.proximityTrigger = true
    }

    // Pokémon-style random encounters: whenever the player comes to rest on a
    // tall-grass tile there's a `chance` of a wild Elemental (drawn from `pool`)
    // ambushing them — the same battle wipe + quiz as a walk-up encounter. Grass
    // is on the `walls` layer (walkable, no collision), so we read that layer's
    // tile at the player's tile and match its GID against the grass GIDs.
    enableGrassEncounters(pool: string[], grassGids: number[], chance: number = 0.15): void {
        // BOOKCLUB M1: wild-encounter quizzes disabled — walking through grass no longer
        // triggers a battle. Reversible: delete this early return.
        return
        const grass = new Set(grassGids)
        const sub = this.gridEngine.movementStopped().subscribe((observer) => {
            if (observer.charId !== this.playerName) return
            if (GlobalInfo._gameProgress.inDialogue) return
            const p = this.gridEngine.getPosition(this.playerName)
            const tile = this.map.getTileAt(p.x, p.y, false, LayerType.Walls)
            if (!tile || !grass.has(tile.index)) return
            if (Math.random() > chance) return
            // Only wild Elementals that have been released can appear.
            const available = pool.filter(elementReleased)
            if (available.length === 0) return
            const id = available[Math.floor(Math.random() * available.length)]
            startBattle(id)
        })
        this.events.once('shutdown', () => sub.unsubscribe())
    }

    // load map resources
    loadMapImages(): void {
        // Tilemap-Bilder laden
        Object.keys(this.imageMapNames).forEach(key => {
            // Use image-specific path, if defined; otherwise use default path
            const path = (this.imageMapNames[key].path != null) ? this.imageMapNames[key].path : this.imageMapDefaultPath

            this.load.image(
                this.imageMapNames[key].name,
                `${path ?? ''}${this.imageMapNames[key].name}.png`)
        })

        // Only fetch the map over the network if a scene didn't embed it.
        if (!this.mapData) {
            this.load.tilemapTiledJSON(this.imageNames.Map, this.tilemapJSONPath)
        }
    }

    // prepare tilesets and create the map
    createMap(): void {
        // Embedded map (offline) → seed the tilemap cache so make.tilemap finds
        // it by key, exactly as load.tilemapTiledJSON would have after fetching.
        if (this.mapData && !this.cache.tilemap.exists(this.imageNames.Map)) {
            this.cache.tilemap.add(this.imageNames.Map, {
                format: Phaser.Tilemaps.Formats.TILED_JSON,
                data: this.mapData,
            })
        }
        const tilesetInfo = Object.keys(this.imageMapNames).map(key => {
            return {
                tilesetName: this.imageMapNames[key].name,
                image: (this.imageMapNames[key].name)
            }
        })

        this.map = createMap({
            scene: this, tilemapTiledJSONKey: this.imageNames.Map, tilesetInfo: tilesetInfo, layerNames: this.layerNames
        }).tilemap
    }

    // GridEngine methods should only be used after this method was called!**
    initiateGridEngine(): void {
        this.playerCharacter = getCharacter(getGuestCharacter());
        this.playerSprite = this.makeAvatarSprite(this.playerCharacter);
        this.appliedLook = this.currentLook();
        const gridEngineConfig = {
            characters: [
                {
                    id: this.playerName,
                    sprite: this.playerSprite,
                    startPosition: this.gridEngineSettings.startPosition,
                    walkingAnimationMapping: this.effectiveMap() as any,
                },
            ],
            layerOverlay: this.gridEngineSettings.layerOverlay,
            characterCollisionStrategy: this.gridEngineSettings.characterCollisionStrategy
        }
        this.gridEngine.create(this.map, gridEngineConfig)
        faceFlip(this.playerSprite, this.playerCharacter, this.gridEngine.getFacingDirection(this.playerName) as unknown as string)
    }

    // Build an avatar sprite for a character: right texture + scale, crisp (NEAREST)
    // filtering for pixel art, and the local colour tint when the character is tintable
    // (the dog tints nicely; pixel townsfolk keep their own colours).
    makeAvatarSprite(def: CharacterDef): Phaser.Physics.Arcade.Sprite {
        const sprite = createCharacterSprite(this, 0, 0, textureKeyFor(this, def), def.scale);
        if (def.pixel) sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        if (def.tintable) sprite.setTint(colorToInt(getGuestColor()));
        return sprite;
    }

    // The frame mapping in effect: the character's flying poses while flight is toggled on
    // (birds only), otherwise its normal walk.
    private effectiveMap(): WalkMap {
        return (this.flying && this.playerCharacter.fly) ? this.playerCharacter.fly : this.playerCharacter.walk;
    }

    // Wing-flap for a hovering bird. grid-engine only cycles frames while the character is
    // moving, so a stationary flyer would freeze on its single standing pose. While flying
    // AND stopped we loop the flap animation ourselves; while moving, grid-engine's walk
    // cycle through the fly frames already beats the wings, so we hand control back to it.
    private updateFlightFlap(): void {
        if (!this.flying || !this.playerCharacter?.fly) return;
        if (this.gridEngine.isMoving(this.playerName)) {
            if (this.playerSprite.anims.isPlaying) this.playerSprite.anims.stop();
            return;
        }
        const dir = this.gridEngine.getFacingDirection(this.playerName) as unknown as string;
        const key = this.ensureFlapAnim(dir);
        if (this.playerSprite.anims.currentAnim?.key !== key || !this.playerSprite.anims.isPlaying) {
            this.playerSprite.anims.play(key, true);
        }
    }

    // Build (once) and name the looping flap animation for the current flying direction.
    // The fly poses sit in a bird sheet's cols 4-7 of a direction's row, so the four flap
    // frames run from that row's standing frame. left/right share the side row (mirrored by
    // faceFlip). Keyed by texture so pigeon and gull don't collide in the global anim store.
    private ensureFlapAnim(dir: string): string {
        const fly = this.playerCharacter.fly!;
        const row = dir === 'up' ? fly.up : dir === 'down' ? fly.down : fly.right;
        const group = dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'side';
        const key = `flap_${this.playerCharacter.textureKey}_${group}`;
        if (!this.anims.exists(key)) {
            const base = row.standing;
            this.anims.create({
                key,
                frames: this.anims.generateFrameNumbers(this.playerCharacter.textureKey!, {
                    frames: [base, base + 1, base + 2, base + 3],
                }),
                frameRate: 8,
                repeat: -1,
            });
        }
        return key;
    }

    private currentLook(): string {
        return `${getGuestCharacter()}|${getGuestColor()}|${this.flying ? 'fly' : 'walk'}`;
    }

    // Re-skin the local player when the chosen character / colour / flight state changes.
    // Rebuilds the grid-engine character in place (same id, same tile + facing), so
    // movement/presence keep working. No-op if nothing changed.
    applyCharacter(): void {
        if (!this.gridEngine?.hasCharacter(this.playerName)) return;
        const def = getCharacter(getGuestCharacter());
        if (!def.fly) this.flying = false;   // non-birds can't fly
        const look = this.currentLook();
        if (look === this.appliedLook) return;
        const pos = this.gridEngine.getPosition(this.playerName);
        const facing = this.gridEngine.getFacingDirection(this.playerName);
        this.gridEngine.removeCharacter(this.playerName);
        this.playerSprite?.destroy();
        this.playerCharacter = def;
        this.playerSprite = this.makeAvatarSprite(def);
        this.gridEngine.addCharacter({
            id: this.playerName,
            sprite: this.playerSprite,
            startPosition: pos,
            walkingAnimationMapping: this.effectiveMap() as any,
            facingDirection: facing,
        });
        this.cameras.main.startFollow(this.playerSprite, true);
        faceFlip(this.playerSprite, this.playerCharacter, facing as unknown as string);
        this.appliedLook = look;
    }

    // Toggle flight (birds only) — press F. Rebuilds the avatar with the fly/walk frames.
    toggleFlight(): void {
        if (!this.playerCharacter?.fly) return;
        this.flying = !this.flying;
        this.applyCharacter();
    }

    // create cameras
    createCamera(boundLimitX: number, boundLimitY: number): void {
        // add camera that follows the character
        this.cameras.main.setBounds(0, 0, boundLimitX, boundLimitY);
        this.cameras.main.startFollow(this.playerSprite, true);
        this.cameras.main.setZoom(2.5)
        // Any area beyond the map bounds letterboxes to black (never a white band),
        // so interiors can keep this fixed zoom instead of a cover-zoom that
        // over-zoomed wide/short rooms on tall (portrait) screens.
        this.cameras.main.setBackgroundColor('#000000')
    }

    switch(key: string | Phaser.Scene): void {
        this.scene.scene.sound.stopAll()
        this.scene.switch(key)
    }
}

// To create special animations (not necessary for walking animations)
function createPlayerAnimation(name: string, startFrame: number, endFrame: number, repeat?: number) {
    this.anims.create({
        key: name,
        frames: this.anims.generateFrameNumbers(this.playerName, {
            start: startFrame,
            end: endFrame,
        }),
        frameRate: 4,
        repeat: repeat ?? -1,
        yoyo: true,
    });
}

// to create all special animations
function createSpecialAnimations(_this: GameScene) {
    createPlayerAnimation.call(_this, "barking", 20, 21, 0);
    createPlayerAnimation.call(_this, "barkingRight", 22, 23, 0);
    createPlayerAnimation.call(_this, "sit", 17, 17, 0);
    createPlayerAnimation.call(_this, "sitRight", 16, 16, 0);
    createPlayerAnimation.call(_this, "sniff", 0, 2, 2);
    createPlayerAnimation.call(_this, "sniffRight", 4, 6, 2);
}