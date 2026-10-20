import { NpcsAndObjects } from './NpcAndObjects';
import GameScene from '../GameScene';
import { ObjectType } from '../enums/ObjectType';
import { drawDoorCue } from './DoorCue';
import { openBookReader, isReaderOpen } from '../../ui/BookReader';
import type { Book } from '../../data/books';

interface BookshelfProps {
    scene: GameScene;
    book: Book;
    // The walkable tile the player stands on to read, relative to the shelf tile.
    // Shelves line the back (north) wall, so the pad is the tile to the south.
    padOffset?: { dx: number; dy: number };
}

// A readable bookshelf. Like a Door, it blocks its own tile (invisible sprite over
// the Library's painted shelf art) and watches for the player coming to rest on the
// pad in front; instead of changing scenes it opens the book in the in-world reader.
export class Bookshelf extends NpcsAndObjects {
    constructor({ scene, book, padOffset }: BookshelfProps) {
        const { x, y } = book.shelf;
        super(scene, ObjectType.Object, x, y, 'emptyDoorGraphic', 1, undefined);

        const off = padOffset ?? { dx: 0, dy: 1 };
        const pad = { x: x + off.dx, y: y + off.dy };

        // Draw the book's cover on its shelf tile so shelves are visually distinct:
        // a coloured spine with the (tiny, wrapped) title. Same tile-pixel convention
        // as DoorCue. A `cover` image on the book would replace this later.
        const tw = scene.map.tileWidth;
        const th = scene.map.tileHeight;
        const cx = x * tw + tw / 2;
        const cy = y * th + th / 2;
        const spine = parseInt(book.spine.replace('#', ''), 16) || 0x888888;
        scene.add.rectangle(cx, cy, tw * 0.8, th * 1.2, spine)
            .setStrokeStyle(1, 0xffffff, 0.9)
            .setDepth(5);
        scene.add.text(cx, cy, book.title, {
            fontFamily: 'Courier New',
            fontSize: '5px',
            color: '#ffffff',
            align: 'center',
            fontStyle: 'bold',
            wordWrap: { width: tw * 0.75 },
        }).setOrigin(0.5).setDepth(6).setResolution(4);

        // A glowing "READ ✦" mat marks the otherwise-invisible pad.
        drawDoorCue(scene, pad.x, pad.y, 'READ', '✦');

        // Open the book when the player's path ends on the pad. movementStopped
        // fires once per completed path (not per tile), so merely walking across
        // the pad won't trigger it — only resting there. Re-opening after close is
        // naturally gated: no new movement happens while reading, and closing
        // leaves the player on the pad until they choose to move again.
        const sub = scene.gridEngine.movementStopped().subscribe(({ charId }) => {
            if (charId !== scene.playerName) return;
            if (isReaderOpen()) return;
            const pos = scene.gridEngine.getPosition(scene.playerName);
            if (pos.x === pad.x && pos.y === pad.y) {
                openBookReader(book, scene);
            }
        });
        scene.events.once('shutdown', () => sub.unsubscribe());
    }
}
