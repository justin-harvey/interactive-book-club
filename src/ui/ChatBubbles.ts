// Floating speech bubbles for the book-club social layer (M5). Shows a short-lived
// text bubble above any grid-engine character — the local player or a remote peer —
// so friends can chat in-world. Pure Phaser (like the name tags in RemotePlayers),
// glued above its sprite each frame and auto-dismissed after a few seconds.

import 'phaser';
import type GameScene from '../Scenes/GameScene';

const LIFETIME_MS = 5000;   // how long a bubble lingers
const MAX_CHARS = 200;      // mirror the server/client cap

interface Bubble { gid: string; text: Phaser.GameObjects.Text; expireAt: number; }

export class ChatBubbles {
    private readonly scene: GameScene;
    private readonly bubbles = new Map<string, Bubble>();
    private updating = false;

    constructor(scene: GameScene) {
        this.scene = scene;
        const onUpdate = (): void => this.tick();
        scene.events.on('update', onUpdate);
        scene.events.once('shutdown', () => { scene.events.off('update', onUpdate); this.clear(); });
    }

    // Show (or replace) the bubble over a character. `gid` is the grid-engine id:
    // the local player's name, or `remote:<peerId>` for a friend.
    show(gid: string, text: string): void {
        const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
        if (!clean || !this.scene.gridEngine.hasCharacter(gid)) return;

        const existing = this.bubbles.get(gid);
        if (existing) { existing.text.setText(clean); existing.expireAt = Date.now() + LIFETIME_MS; this.position(existing); return; }

        const t = this.scene.add.text(0, 0, clean, {
            fontFamily: 'Courier New', fontSize: '8px', color: '#10203a',
            align: 'center', fontStyle: 'bold',
            backgroundColor: '#ffffff', padding: { x: 5, y: 3 },
            wordWrap: { width: 120 },
        }).setOrigin(0.5, 1).setDepth(60).setResolution(4);
        const bubble: Bubble = { gid, text: t, expireAt: Date.now() + LIFETIME_MS };
        this.bubbles.set(gid, bubble);
        this.position(bubble);
    }

    private position(b: Bubble): void {
        const ge = this.scene.gridEngine;
        if (!ge.hasCharacter(b.gid)) return;
        const sprite = ge.getSprite(b.gid);
        if (!sprite) return;
        // Sit above the name tag (which is at -displayHeight*0.5 - 2).
        b.text.setPosition(sprite.x, sprite.y - sprite.displayHeight * 0.5 - 12);
    }

    private tick(): void {
        if (this.updating) return;
        this.updating = true;
        const now = Date.now();
        const expired: string[] = [];
        this.bubbles.forEach((b, gid) => {
            if (now >= b.expireAt || !this.scene.gridEngine.hasCharacter(gid)) { expired.push(gid); return; }
            this.position(b);
        });
        expired.forEach(gid => this.remove(gid));
        this.updating = false;
    }

    // Drop a character's bubble (e.g. when they leave the room).
    remove(gid: string): void {
        const b = this.bubbles.get(gid);
        if (!b) return;
        b.text.destroy();
        this.bubbles.delete(gid);
    }

    clear(): void {
        this.bubbles.forEach(b => b.text.destroy());
        this.bubbles.clear();
    }

    // The text currently shown over a character, or null. Used by the E2E hook.
    textFor(gid: string): string | null {
        const b = this.bubbles.get(gid);
        return b ? b.text.text : null;
    }
}
