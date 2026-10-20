// Renders other members in the current scene as avatars that move in real time. Each
// remote is drawn as the character THAT peer chose (see data/characters.ts) — the pixel
// townsfolk or the dog — with that character's walk mapping and scale; grid-engine walks
// them tile-to-tile from the per-tile updates the server relays, so motion interpolates
// smoothly. A small colour-coded name tag floats above each.

import 'phaser';
import type GameScene from '../Scenes/GameScene';
import { createCharacterSprite } from '../Scenes/components/NpcAndObjects';
import { colorToInt, textOn } from './identity';
import { getCharacter, textureKeyFor, type CharacterDef } from '../data/characters';
import type { Peer } from './PresenceClient';

interface Remote { gid: string; name: string; color: string; character: string; label: Phaser.GameObjects.Text; }

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

    // Build a sprite for a character (texture/scale, crisp pixels, colour tint only when
    // the character is tintable — the dog; pixel townsfolk keep their own colours).
    private buildSprite(def: CharacterDef, color: string): Phaser.GameObjects.Sprite {
        const sprite = createCharacterSprite(this.scene, 0, 0, textureKeyFor(this.scene, def), def.scale);
        if (def.pixel) sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        if (def.tintable && color) sprite.setTint(colorToInt(color));
        return sprite;
    }

    private addGeChar(gid: string, def: CharacterDef, color: string, x: number, y: number, facing: string): void {
        this.scene.gridEngine.addCharacter({
            id: gid,
            sprite: this.buildSprite(def, color),
            startPosition: { x, y },
            walkingAnimationMapping: def.walk as any,
            facingDirection: (facing as any) || 'down',
        });
    }

    upsert(peer: Peer): void {
        if (!peer || !peer.id) return;
        const ge = this.scene.gridEngine;
        const gid = this.gidOf(peer.id);
        const existing = this.remotes.get(peer.id);

        if (!existing) {
            const color = peer.color || '';
            const character = peer.character || '';
            this.addGeChar(gid, getCharacter(character), color, peer.x, peer.y, peer.facing);
            const label = this.scene.add.text(0, 0, peer.name || 'Guest', {
                fontFamily: 'Courier New', fontSize: '7px',
                color: color ? textOn(color) : '#ffffff',
                align: 'center', fontStyle: 'bold',
                backgroundColor: color || 'rgba(16,32,58,0.75)',
            }).setOrigin(0.5, 1).setDepth(50).setResolution(4);
            this.remotes.set(peer.id, { gid, name: peer.name || 'Guest', color, character, label });
            return;
        }

        // Keep the name if this update carried one (move frames don't).
        if (peer.name) { existing.name = peer.name; existing.label.setText(peer.name); }

        // Character change (re-announce after the Avatar panel) → rebuild the sprite in
        // place, preserving tile + facing. Move frames omit character, so this is skipped.
        if (peer.character && peer.character !== existing.character) {
            existing.character = peer.character;
            let x = peer.x, y = peer.y, facing: string = peer.facing || 'down';
            if (ge.hasCharacter(gid)) {
                const p = ge.getPosition(gid); x = p.x; y = p.y;
                facing = (ge.getFacingDirection(gid) as unknown as string) || facing;
                ge.removeCharacter(gid);
            }
            this.addGeChar(gid, getCharacter(existing.character), existing.color, x, y, facing);
        }

        // Colour change → always recolour the name tag; re-tint the sprite only if the
        // character is tintable (the dog).
        if (peer.color && peer.color !== existing.color) {
            existing.color = peer.color;
            existing.label.setColor(textOn(peer.color)).setBackgroundColor(peer.color);
            if (getCharacter(existing.character).tintable && ge.hasCharacter(gid)) {
                const s = ge.getSprite(gid); if (s) s.setTint(colorToInt(peer.color));
            }
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

    // Avatar colour / display name / character a peer is currently using, or null. E2E hook.
    colorFor(id: string): string | null { return this.remotes.get(id)?.color || null; }
    nameFor(id: string): string | null { return this.remotes.get(id)?.name || null; }
    characterFor(id: string): string | null { return this.remotes.get(id)?.character || null; }

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
