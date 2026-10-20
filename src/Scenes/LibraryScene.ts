import { InteriorScene } from './InteriorScene';
import { SceneName } from './enums/SceneNames';
import { Bookshelf } from './components/Bookshelf';
import { NowReadingSign } from './components/NowReadingSign';
import { BOOKS } from '../data/books';
import { currentSeason } from '../data/bookSeason';
import { closeBookReader } from '../ui/BookReader';
import { closeNowReadingPicker } from '../ui/NowReadingPicker';

// The Library — a quiet reading room. Shelves along the back wall each open a book
// in the in-world reader (see Bookshelf + BookReader). Walkable floor is rows 7-14,
// spawn (8,8); shelves sit on the north wall (row 7). The empty elementIds list means
// no Elementals spawn here (lesson layer neutralized in M1).
export default class LibraryScene extends InteriorScene {
    constructor() {
        super(SceneName.Library, 'library-interior.png', [], 'room_library');
    }

    create(): void {
        super.create();

        // One readable shelf per catalogued book.
        BOOKS.forEach(book => new Bookshelf({ scene: this, book }));

        // The club's "Now Reading" placard — shared pick, set from in-world.
        new NowReadingSign({ scene: this });

        // A small seasonal sign on the back wall — cheap "the room changes" flavour (M7).
        const season = currentSeason();
        const tw = this.map.tileWidth;
        const th = this.map.tileHeight;
        this.add.text(8 * tw + tw / 2, 7 * th + th * 0.1, `${season.emoji} ${season.name}\n${season.blurb}`, {
            fontFamily: 'Courier New', fontSize: '5px', color: '#ffd166',
            align: 'center', fontStyle: 'bold', wordWrap: { width: tw * 2.6 },
        }).setOrigin(0.5, 0).setDepth(6).setResolution(4);

        // If the player leaves (or the scene sleeps) while a book/chooser is open, close
        // it so nothing lingers over the town.
        const closeOverlays = (): void => { closeBookReader(); closeNowReadingPicker(); };
        this.events.on('sleep', closeOverlays);
        this.events.on('shutdown', closeOverlays);
    }
}
