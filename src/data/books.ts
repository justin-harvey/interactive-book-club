// The Library catalog. Each entry is one book on one shelf.
//
// `file` is a URL the in-world reader loads with PDF.js (rendered to a canvas we
// control, so we can remember the reader's page — see BookReader). For now files live
// in assets/books/ and are bundled; later they'll be served from a NAS-mounted folder
// (just point `file` at that path / origin).
//
// `shelf` is the tile the (invisible) bookshelf sits on; the player reads by coming
// to rest on the tile just south of it (the "pad"). Shelves line the Library's back
// wall (row 7); walkable floor is rows 7-14, spawn is (8,8); see LibraryScene.
//
// `spine` is the cover colour drawn on the shelf in-world (a titled book spine) so the
// books are visually distinct without needing cover art. Optional `cover` (an image
// path) can override it later with real artwork.

export interface Book {
    id: string;
    title: string;
    author: string;
    file: string;            // URL/path to the PDF
    shelf: { x: number; y: number };
    spine: string;           // hex colour for the in-world spine, e.g. '#c1443b'
    cover?: string;          // optional cover image path (overrides the spine art)
}

export const BOOKS: Book[] = [
    {
        id: 'welcome',
        title: 'Welcome',
        author: 'The Librarian',
        file: 'assets/books/welcome.pdf',
        shelf: { x: 6, y: 7 },
        spine: '#c1443b',
    },
    {
        id: 'field-notes',
        title: 'Field Notes',
        author: 'A. Friend',
        file: 'assets/books/field-notes.pdf',
        shelf: { x: 7, y: 7 },
        spine: '#2f7d55',
    },
    {
        id: 'the-long-one',
        title: 'The Long One',
        author: 'A. Friend',
        file: 'assets/books/the-long-one.pdf',
        shelf: { x: 9, y: 7 },
        spine: '#3a5bbf',
    },
    // Add more books here. Point `file` at a PDF in assets/books/ (or a NAS URL), give
    // each a free back-wall shelf tile, and pick a spine colour.
];
