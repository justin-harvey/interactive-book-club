import 'phaser';
import GameScene from '../GameScene';
import { SceneName } from '../enums/SceneNames';

// A walkable teleport tile (unlike a Door, which blocks its own tile and triggers
// from the pad beside it). The museum floors use these instead of fixed doors:
// the player paints ascend (green), descend (blue) and custom (purple) tiles, and
// coming to rest on any tile of a portal warps to its target scene. A pulsing
// coloured marker + arrow makes each portal visible.
export interface PortalStyle { color: number; symbol: '▲' | '▼' | '✦'; label: string; }

// Where the player should re-appear when they arrive in a scene via a portal,
// keyed by the target SceneName. Set by the portal that fired, read+cleared by the
// destination floor on entry so you land at the matching portal (descend down ->
// arrive on the floor's ascend/up portal, and vice-versa). A module-level handoff
// because Phaser's scene.switch carries no payload.
export const MUSEUM_ARRIVAL: Record<string, 'ascend' | 'descend'> = {};

export class Portal {
    constructor(
        scene: GameScene,
        tiles: { x: number; y: number }[],
        target: SceneName,
        style: PortalStyle,
        // Portal type to spawn at on the destination floor (opposite of travel):
        // an ascend portal lands you on the target's descend portal, and vice-versa.
        arriveAt?: 'ascend' | 'descend',
    ) {
        const tw = scene.map.tileWidth;
        const th = scene.map.tileHeight;
        const key = tiles.map(t => `${t.x},${t.y}`);

        for (const t of tiles) {
            const cx = t.x * tw + tw / 2;
            const cy = t.y * th + th / 2;
            const mat = scene.add.rectangle(cx, cy, tw, th, style.color, 0.28)
                .setStrokeStyle(1, style.color, 0.9)
                .setDepth(5);
            const label = scene.add.text(cx, cy, `${style.symbol}\n${style.label}`, {
                fontFamily: 'Courier New', fontSize: '8px',
                color: '#ffffff', align: 'center', fontStyle: 'bold',
            }).setOrigin(0.5).setDepth(6).setResolution(4);
            scene.tweens.add({
                targets: [mat, label], alpha: { from: 0.5, to: 1 },
                duration: 850, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
        }

        // Fire only when the player STEPS ONTO the portal — i.e. it must first be
        // "armed" by the player being off it. Spawning next to (or on) a portal
        // therefore never triggers it, which is what previously caused an infinite
        // switch loop (white screen / unresponsive). Re-arm on wake, since arriving
        // repositions the dog beside the portal.
        const onPortal = (): boolean => {
            const p = scene.gridEngine.getPosition(scene.playerName);
            return key.includes(`${p.x},${p.y}`);
        };
        let armed = !onPortal();
        const reArm = (): void => { armed = !onPortal(); };
        scene.events.on('wake', reArm);

        const sub = scene.gridEngine.movementStopped().subscribe(({ charId }) => {
            if (charId !== scene.playerName) return;
            if (!onPortal()) { armed = true; return; }   // stepped off → ready to fire next time
            if (!armed) return;                          // arrived/spawned on it → ignore
            armed = false;
            if (arriveAt) MUSEUM_ARRIVAL[target] = arriveAt;
            scene.switch(target);
        });
        scene.events.once('shutdown', () => { sub.unsubscribe(); scene.events.off('wake', reArm); });
    }
}
