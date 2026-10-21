// Selectable avatar characters. Friends can look different instead of all being the same
// dog. Two kinds live here:
//   • the original hand-drawn dog "Perli" (198x188 frames, Justin's own art), and
//   • 15 CC0 pixel townsfolk (16x24 frames) from piano-no-renshu's "15 Top-Down Character
//     Sprites" pack (public domain, CC0 1.0 — see CREDITS.md).
//
// Each entry carries everything the engine needs to render that character anywhere: the
// spritesheet, its frame size, a grid-engine walkingAnimationMapping, an on-screen scale,
// and whether the colour tint applies to the sprite (the dog tints nicely; the pixel art
// looks best in its own colours, so only the name tag uses colour for them).
//
// The chosen character id is part of a guest's identity and syncs over presence exactly
// like name/colour, so everyone sees everyone else as their pick (see identity.ts + net/).

import 'phaser';
import type GameScene from '../Scenes/GameScene';

export interface DirFrames { leftFoot: number; standing: number; rightFoot: number; }
export interface WalkMap { up: DirFrames; down: DirFrames; left: DirFrames; right: DirFrames; }

export interface CharacterDef {
    id: string;
    label: string;
    frameWidth: number;
    frameHeight: number;
    scale: number;
    tintable: boolean;   // apply the avatar colour as a sprite tint?
    pixel: boolean;      // pixel art → NEAREST filter + crisp thumbnail
    special: boolean;    // has the dog-only bark/sniff easter egg
    walk: WalkMap;
    textureKey?: string;  // fixed global texture key (pixel chars); the dog resolves per-scene
    sheet?: string;       // asset path to load (pixel chars); the dog is loaded elsewhere
    sheetWidth?: number;  // full PNG dims (pixel chars) — used for picker thumbnails
    sheetHeight?: number;
    mirror?: boolean;     // 3-direction art (no separate right row) — flip the sprite for 'right'
    thumbFrame?: number;  // frame index to show in the picker (default 0)
}

// The dog's layout (a wide multi-row sheet with extra special-action frames).
const DOG_WALK: WalkMap = {
    up: { leftFoot: 25, standing: 24, rightFoot: 26 },
    down: { leftFoot: 29, standing: 28, rightFoot: 30 },
    left: { leftFoot: 9, standing: 8, rightFoot: 11 },
    right: { leftFoot: 13, standing: 12, rightFoot: 15 },
};

// The townsfolk sheets are a 4-col x 4-row grid of 16x24 frames. Rows are directions in
// the order Down, Right, Up, Left (verified in-game: moving right shows row 3's art, which
// faces left — so row 1 is the right-facing art and row 3 the left-facing one). Within a
// row frame 0 is the neutral standing pose and frames 1 & 3 are the two steps.
const TOWNSFOLK_WALK: WalkMap = {
    down: { leftFoot: 1, standing: 0, rightFoot: 3 },    // row 0 (front)
    right: { leftFoot: 5, standing: 4, rightFoot: 7 },   // row 1 (right-facing)
    up: { leftFoot: 9, standing: 8, rightFoot: 11 },     // row 2 (back)
    left: { leftFoot: 13, standing: 12, rightFoot: 15 }, // row 3 (left-facing)
};

// The animal sheets are a 4-col grid of 32x32 frames. Rows are directions in the order
// Down, Right, Left, Up (read from the art — the fox's tail trails behind, so row 1 with
// the tail on the left faces right, and row 2 with the tail on the right faces left).
const ANIMAL_WALK: WalkMap = {
    down: { leftFoot: 1, standing: 0, rightFoot: 3 },   // row 0
    right: { leftFoot: 5, standing: 4, rightFoot: 7 },  // row 1
    left: { leftFoot: 9, standing: 8, rightFoot: 11 },  // row 2
    up: { leftFoot: 13, standing: 12, rightFoot: 15 },  // row 3
};

// Three creatures isolated from the atlas: 16x16 frames, 8 cols, rows Left/Down/Up only
// (no separate right — these use `mirror` to flip for the right-facing direction, so
// `right` reuses the `left` frames). The hamster keeps its standing pose at col 0 and its
// 4-frame run at cols 4-7 (cols 1-3 are an atlas gap); the birds walk on cols 0-3.
const HAMSTER_WALK: WalkMap = {
    left: { leftFoot: 4, standing: 0, rightFoot: 6 },    // row 0: col0 sit + cols4-7 run
    down: { leftFoot: 12, standing: 8, rightFoot: 14 },  // row 1
    up: { leftFoot: 20, standing: 16, rightFoot: 22 },   // row 2
    right: { leftFoot: 4, standing: 0, rightFoot: 6 },   // = left, mirrored
};
const BIRD_WALK: WalkMap = {
    left: { leftFoot: 1, standing: 0, rightFoot: 3 },    // row 0: cols0-3 walk (4-7 = flying)
    down: { leftFoot: 9, standing: 8, rightFoot: 11 },   // row 1
    up: { leftFoot: 17, standing: 16, rightFoot: 19 },   // row 2
    right: { leftFoot: 1, standing: 0, rightFoot: 3 },   // = left, mirrored
};

export const DOG_ID = 'perli';

const dog: CharacterDef = {
    id: DOG_ID, label: 'Perli the dog',
    frameWidth: 198, frameHeight: 188, scale: 0.15,
    tintable: true, pixel: false, special: true, walk: DOG_WALK,
};

const townsfolk: CharacterDef[] = Array.from({ length: 15 }, (_, i) => {
    const n = i + 1;
    return {
        id: `tf${n}`, label: `Villager ${n}`,
        frameWidth: 16, frameHeight: 24, scale: 1,
        tintable: false, pixel: true, special: false, walk: TOWNSFOLK_WALK,
        textureKey: `ibc_tf_${n}`, sheet: `assets/Characters/townsfolk/${n}.png`,
        sheetWidth: 64, sheetHeight: 96,
    };
});

// Cozy animal avatars (32x32 frames). scale 0.75 lands them around the villagers' height.
const animalArt: { id: string; label: string; file: string }[] = [
    { id: 'cat_gray', label: 'Gray cat', file: 'cat-gray' },
    { id: 'cat_orange', label: 'Orange cat', file: 'cat-orange' },
    { id: 'fox', label: 'Fox', file: 'fox' },
    { id: 'raccoon', label: 'Raccoon', file: 'raccoon' },
    { id: 'bird_white', label: 'White bird', file: 'bird-white' },
    { id: 'bird_blue', label: 'Blue bird', file: 'bird-blue' },
];
const animals: CharacterDef[] = animalArt.map(a => ({
    id: a.id, label: a.label,
    frameWidth: 32, frameHeight: 32, scale: 0.75,
    tintable: false, pixel: true, special: false, walk: ANIMAL_WALK,
    textureKey: `ibc_${a.id}`, sheet: `assets/Characters/animals/${a.file}.png`,
    sheetWidth: 128, sheetHeight: 416,
}));

// Small 16x16 critters (3-direction, mirrored for right). thumbFrame 8 = the down-facing
// standing pose, so the picker shows them facing the viewer.
const critterArt: { id: string; label: string; file: string; walk: WalkMap }[] = [
    { id: 'hamster', label: 'Hamster', file: 'hamster', walk: HAMSTER_WALK },
    { id: 'pigeon', label: 'Pigeon', file: 'pigeon', walk: BIRD_WALK },
    { id: 'gull', label: 'Gull', file: 'gull', walk: BIRD_WALK },
];
const critters: CharacterDef[] = critterArt.map(c => ({
    id: c.id, label: c.label,
    frameWidth: 16, frameHeight: 16, scale: 1,
    tintable: false, pixel: true, special: false, mirror: true, thumbFrame: 8, walk: c.walk,
    textureKey: `ibc_${c.id}`, sheet: `assets/Characters/animals/${c.file}.png`,
    sheetWidth: 128, sheetHeight: c.id === 'hamster' ? 96 : 48,
}));

export const CHARACTERS: CharacterDef[] = [...townsfolk, ...animals, ...critters, dog];
const BY_ID = new Map(CHARACTERS.map(c => [c.id, c]));

export function getCharacter(id: string | undefined): CharacterDef {
    return (id && BY_ID.get(id)) || BY_ID.get(DOG_ID)!;
}

// Pixel townsfolk only — the pool a fresh guest is seeded into (so a room auto-varies).
export const DEFAULT_POOL = townsfolk;

// A stable default character for a guest id (variety out of the box; the dog stays an
// explicit choice). Deterministic so the same device always starts as the same villager.
export function defaultCharacterId(guestId: string): string {
    let h = 0;
    for (let i = 0; i < guestId.length; i++) h = (h * 31 + guestId.charCodeAt(i)) >>> 0;
    return DEFAULT_POOL[h % DEFAULT_POOL.length].id;
}

// The Phaser texture key for a character in a given scene. Pixel chars use their fixed
// global key; the dog uses the scene's per-scene Perli key (imageNames.Perli).
export function textureKeyFor(scene: GameScene, def: CharacterDef): string {
    return def.pixel ? def.textureKey! : scene.imageNames.Perli;
}

// Mirror the sprite horizontally for the right-facing direction when a character only has
// left art (3-direction creatures). grid-engine's walk mapping can't flip, so we do it here
// on direction changes, for both the local player and remotes. No-op for 4-direction chars.
export function faceFlip(sprite: Phaser.GameObjects.Sprite | undefined | null, def: CharacterDef, facing: string): void {
    if (def && def.mirror && sprite) sprite.setFlipX(facing === 'right');
}

// Load every pixel character sheet once (townsfolk + animals; idempotent across scene
// preloads). Call from a scene's preload. The dog is loaded separately (loadAvatarSpritesheet).
export function loadCharacterSheets(scene: GameScene): void {
    for (const c of CHARACTERS) {
        if (c.pixel && c.sheet && c.textureKey && !scene.textures.exists(c.textureKey)) {
            scene.load.spritesheet(c.textureKey, c.sheet, { frameWidth: c.frameWidth, frameHeight: c.frameHeight });
        }
    }
}
