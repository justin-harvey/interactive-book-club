import GameScene from '../GameScene';

// A pulsing highlight + label drawn on a door's step-on pad, so entrances and
// exits are visible instead of invisible trigger tiles (new players couldn't
// tell buildings were enterable). `arrow` points from the pad toward the door:
// ▲ when the door is above the pad (town entrances), ▼ when below (interior exit).
// ✦ is a non-directional point-of-interest marker (e.g. the Atlantis Core pad).
export function drawDoorCue(
    scene: GameScene,
    padTileX: number,
    padTileY: number,
    label: string,
    arrow: '▲' | '▼' | '✦',
): void {
    const tw = scene.map.tileWidth;
    const th = scene.map.tileHeight;
    const cx = padTileX * tw + tw / 2;
    const cy = padTileY * th + th / 2;

    const mat = scene.add.rectangle(cx, cy, tw, th, 0xffd166, 0.22)
        .setStrokeStyle(1, 0xffd166, 0.85)
        .setDepth(5);
    // Keep the arrow next to the door: below the label for ▼ (door is under the pad),
    // above it otherwise (▲ entrances, ✦ point-of-interest markers).
    const text = arrow === '▼' ? `${label}\n${arrow}` : `${arrow}\n${label}`;
    const t = scene.add.text(cx, cy, text, {
        fontFamily: 'Courier New',
        fontSize: '9px',
        color: '#ffd166',
        align: 'center',
        fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(6).setResolution(4);

    scene.tweens.add({
        targets: [mat, t],
        alpha: { from: 0.55, to: 1 },
        duration: 850,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
    });
}
