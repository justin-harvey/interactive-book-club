// Elementals are *cloaked*: rendered so faint they're hard to spot by eye, so the
// Rad Finder (the DEX "Track" arrow) is how you're meant to find them. The
// proximity trigger still fires within one tile regardless of visibility, so a
// cloaked Elemental is always catchable — you can walk onto it even if you never
// quite see it. No animation on purpose: a steady, barely-there alpha (nothing to
// flash or distract, and reduce-motion-safe by construction).

// How visible a cloaked Elemental is (0 = invisible, 1 = solid). Very faint by
// design — nudge up if they end up impossible to find, down if too obvious.
const CLOAK_ALPHA = 0.1;

// Make an Elemental's sprite very faint / hardly noticeable. Only touches alpha —
// a property grid-engine never writes — so it can't fight the movement system.
export function cloakElemental(sprite: Phaser.GameObjects.Sprite): void {
    sprite.setAlpha(CLOAK_ALPHA);
}
