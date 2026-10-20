import { NpcsAndObjects } from './NpcAndObjects';
import GameScene from '../GameScene';
import { ObjectType } from '../enums/ObjectType';
import { drawDoorCue } from './DoorCue';
import { BOOKS } from '../../data/books';
import { getNowReading, setNowReading, onNowReadingChange } from '../../net/clubState';
import { getPresenceClient } from '../../net/PresenceClient';
import { openNowReadingPicker, isNowReadingPickerOpen } from '../../ui/NowReadingPicker';

interface NowReadingSignProps {
    scene: GameScene;
    // The tile the placard sits on; the player steps onto the tile just south of it.
    tile?: { x: number; y: number };
}

const titleFor = (id: string): string => BOOKS.find(b => b.id === id)?.title ?? '— pick one —';

// The club's "Now Reading" placard — the social centrepiece of the Library. Like a
// Bookshelf it blocks its own tile and watches the pad in front, but instead of opening
// a book it shows the shared club pick (synced to everyone via presence) and, on step,
// opens a chooser to change it. The displayed title live-updates whenever anyone sets it.
export class NowReadingSign extends NpcsAndObjects {
    constructor({ scene, tile }: NowReadingSignProps) {
        const at = tile ?? { x: 10, y: 8 };
        super(scene, ObjectType.Object, at.x, at.y, 'emptyDoorGraphic', 1, undefined);

        const pad = { x: at.x, y: at.y + 1 };
        const tw = scene.map.tileWidth;
        const th = scene.map.tileHeight;
        const cx = at.x * tw + tw / 2;
        const cy = at.y * th + th / 2;

        // The placard: a board with a "Now Reading" header and the current pick's title.
        scene.add.rectangle(cx, cy, tw * 1.4, th * 1.5, 0x10203a)
            .setStrokeStyle(2, 0xffd166, 0.95)
            .setDepth(5);
        scene.add.text(cx, cy - th * 0.5, '📖 NOW\nREADING', {
            fontFamily: 'Courier New', fontSize: '6px', color: '#ffd166',
            align: 'center', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(6).setResolution(4);
        const titleText = scene.add.text(cx, cy + th * 0.25, titleFor(getNowReading()), {
            fontFamily: 'Courier New', fontSize: '6px', color: '#ffffff',
            align: 'center', fontStyle: 'bold', wordWrap: { width: tw * 1.3 },
        }).setOrigin(0.5, 0).setDepth(6).setResolution(4);

        // Live-update the title whenever the shared pick changes (from anyone).
        const off = onNowReadingChange(id => titleText.setText(titleFor(id)));

        // A glowing "CLUB ✦" mat marks the step-on pad.
        drawDoorCue(scene, pad.x, pad.y, 'CLUB', '✦');

        // Resting on the pad opens the chooser (same movementStopped gate as Bookshelf).
        const sub = scene.gridEngine.movementStopped().subscribe(({ charId }) => {
            if (charId !== scene.playerName) return;
            if (isNowReadingPickerOpen()) return;
            const pos = scene.gridEngine.getPosition(scene.playerName);
            if (pos.x !== pad.x || pos.y !== pad.y) return;
            openNowReadingPicker(scene, getNowReading(), (bookId) => {
                setNowReading(bookId);                       // optimistic local update
                getPresenceClient().setNowReading(bookId);   // persist + sync to everyone
            });
        });

        scene.events.once('shutdown', () => { off(); sub.unsubscribe(); });
    }
}
