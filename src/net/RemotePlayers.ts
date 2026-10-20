// Renders other members in the current scene as avatars that move in real time.
// Each remote uses the same dog avatar art + walking animation as the local player;
// grid-engine walks them tile-to-tile (from the per-tile updates the server relays),
// so movement interpolates smoothly. A small name tag floats above each.

import 'phaser';
import type GameScene from '../Scenes/GameScene';
import { createCharacterSprite } from '../Scenes/components/NpcAndObjects';
import { colorToInt, textOn } from './identity';
import type { Peer } from './PresenceClient';

// Same frame layout as the local player (see GameScene.initiateGridEngine).
const WALK_MAP = {
    up: { leftFoot: 25, standing: 24, rightFoot: 26 },
    down: { leftFoot: 29, standing: 28, rightFoot: 30 },
    left: { leftFoot: 9, standing: 8, rightFoot: 11 },
    right: { leftFoot: 13, standing: 12, rightFoot: 15 },
};

interface Remote { gid: string; name: string; color: string; label: Phaser.GameObjects.Text; }

// grid-engine character id for a remote peer. Shared so chat bubbles can target the
// same sprite RemotePlayers manages.
export function remoteGid(id: string): string { return `remote:${id}`; }

export class RemotePlayers {
    private readonly scene: GameScene;
    private readonly remotes = new Map<string, Remote>();
    private updating = false;

    constructor(scene: GameScene) {
        this.scene = scene;
        // Keep name tags glued above their avatars.
        const onUpdate = (): void => this.repositionLabels();
        scene.events.on('update', onUpdate);
        scene.events.once('shutdown', () => { scene.events.off('update', onUpdate); this.clear(); });
    }

    private gidOf(id: string): string { return remoteGid(id); }

    upsert(peer: Peer): void {
        if (!peer || !peer.id) return;
        const ge = this.scene.gridEngine;
        const gid = this.gidOf(peer.id);
        const existing = this.remotes.get(peer.id);

        if (!existing) {
            const color = peer.color || '';
            const sprite = createCharacterSprite(this.scene, 0, 0, this.scene.imageNames.Perli, this.scene.avatarScale);
            if (color) sprite.setTint(colorToInt(color));
            ge.addCharacter({
                id: gid,
                sprite,
                startPosition: { x: peer.x, y: peer.y },
                walkingAnimationMapping: WALK_MAP as any,
                facingDirection: (peer.facing as any) || 'down',
            });
            const label = this.scene.add.text(0, 0, peer.name || 'Guest', {
                fontFamily: 'Courier New', fontSize: '7px',
                color: color ? textOn(color) : '#ffffff',
                align: 'center', fontStyle: 'bold',
                backgroundColor: color || 'rgba(16,32,58,0.75)',
            }).setOrigin(0.5, 1).setDepth(50).setResolution(4);
            this.remotes.set(peer.id, { gid, name: peer.name || 'Guest', color, label });
            return;
        }

        // Keep the name if this update carried one (move frames don't).
        if (peer.name) { existing.name = peer.name; existing.label.setText(peer.name); }
        // Apply a colour change (re-announce after the Avatar panel); move frames omit it.
        if (peer.color && peer.color !== existing.color) {
            existing.color = peer.color;
            existing.label.setColor(textOn(peer.color)).setBackgroundColor(peer.color);
            if (ge.hasCharacter(gid)) { const s = ge.getSprite(gid); if (s) s.setTint(colorToInt(peer.color)); }
        }
        if (!ge.hasCharacter(gid)) return;
        const cur = ge.getPosition(gid);
        if (cur.x !== peer.x || cur.y !== peer.y) {
            const far = Math.max(Math.abs(cur.x - peer.x), Math.abs(cur.y - peer.y)) > 3;
            if (far) ge.setPosition(gid, { x: peer.x, y: peer.y });   // teleport / room entry
            else ge.moveTo(gid, { x: peer.x, y: peer.y });            // walk one+ tiles
        } else if (peer.facing) {
            try { ge.turnTowards(gid, peer.facing as any); } catch { /* ignore */ }
        }
    }

    remove(id: string): void {
        const r = this.remotes.get(id);
        if (!r) return;
        try { if (this.scene.gridEngine.hasCharacter(r.gid)) this.scene.gridEngine.removeCharacter(r.gid); } catch { /* ignore */ }
        r.label.destroy();
        this.remotes.delete(id);
    }

    // Replace the whole set with a server snapshot (on entering a room).
    sync(peers: Peer[]): void {
        const keep = new Set(peers.map(p => p.id));
        const stale: string[] = [];
        this.remotes.forEach((_, id) => { if (!keep.has(id)) stale.push(id); });
        stale.forEach(id => this.remove(id));
        peers.forEach(p => this.upsert(p));
    }

    clear(): void {
        const ids: string[] = [];
        this.remotes.forEach((_, id) => ids.push(id));
        ids.forEach(id => this.remove(id));
    }

    count(): number { return this.remotes.size; }

    // The avatar colour / display name a peer is currently using, or null. For the E2E hook.
    colorFor(id: string): string | null { return this.remotes.get(id)?.color || null; }
    nameFor(id: string): string | null { return this.remotes.get(id)?.name || null; }

    private repositionLabels(): void {
        if (this.updating) return;
        this.updating = true;
        const ge = this.scene.gridEngine;
        this.remotes.forEach(r => {
            if (!ge.hasCharacter(r.gid)) return;
            const sprite = ge.getSprite(r.gid);
            if (!sprite) return;
            r.label.setPosition(sprite.x, sprite.y - sprite.displayHeight * 0.5 - 2);
        });
        this.updating = false;
    }
}
