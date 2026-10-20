// Floating emote reactions for the book-club social layer (M5). When someone reacts,
// a big glyph pops above their avatar, drifts upward and fades out. Lighter-weight and
// more playful than a chat bubble (see ChatBubbles) — no background, no persistence.
// Pure Phaser, like the name tags in RemotePlayers.

import 'phaser';
import type GameScene from '../Scenes/GameScene';

const RISE_PX = 26;        // how far the glyph drifts up
const LIFETIME_MS = 1400;  // pop-and-fade duration

// The emotes offered in the picker. The server relays any short glyph, but the client
// only ever sends from this set.
export const EMOTES = ['👍', '❤️', '😂', '👋', '📖', '🎉'];

export class Emotes {
    private readonly scene: GameScene;
    // Most recent glyph shown per character, for the E2E hook (not used in play).
    private readonly last = new Map<string, string>();

    constructor(scene: GameScene) {
        this.scene = scene;
        scene.events.once('shutdown', () => this.last.clear());
    }

    // Pop an emote over a character. `gid` is the grid-engine id: the local player's
    // name, or `remote:<peerId>` for a friend.
    show(gid: string, glyph: string): void {
        const e = String(glyph || '').trim().slice(0, 8);
        if (!e || !this.scene.gridEngine.hasCharacter(gid)) return;
        this.last.set(gid, e);

        const sprite = this.scene.gridEngine.getSprite(gid);
        if (!sprite) return;
        const startY = sprite.y - sprite.displayHeight * 0.5 - 6;
        const t = this.scene.add.text(sprite.x, startY, e, {
            fontFamily: 'sans-serif', fontSize: '18px', align: 'center',
        }).setOrigin(0.5, 1).setDepth(61).setResolution(4);

        this.scene.tweens.add({
            targets: t,
            y: startY - RISE_PX,
            alpha: { from: 1, to: 0 },
            duration: LIFETIME_MS,
            ease: 'Cubic.easeOut',
            onComplete: () => t.destroy(),
        });
    }

    // Most recent glyph a character reacted with, or null. Used by the E2E hook.
    lastFor(gid: string): string | null {
        return this.last.get(gid) ?? null;
    }
}
