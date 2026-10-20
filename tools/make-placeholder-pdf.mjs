// Generates small, valid multi-page PDFs used as placeholder books so the in-world
// reader has something to open before real books are mounted from the NAS. Builds
// the cross-reference table with correct byte offsets by hand (strict viewers reject
// a bad xref). All text is original.
//
// Usage: node tools/make-placeholder-pdf.mjs   (writes all books into src/assets/books)
import { writeFileSync, mkdirSync } from 'node:fs';

const esc = s => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

// Build a valid PDF from a list of { title, body[] } pages.
function buildPdf(pages) {
    const objects = [];
    const pageObjNums = [];
    let next = 4;
    for (let i = 0; i < pages.length; i++) { pageObjNums.push({ page: next, contents: next + 1 }); next += 2; }

    objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
    objects[2] = `<< /Type /Pages /Kids [${pageObjNums.map(p => `${p.page} 0 R`).join(' ')}] /Count ${pages.length} >>`;
    objects[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

    pages.forEach((pg, i) => {
        const { page, contents } = pageObjNums[i];
        let stream = `BT /F1 22 Tf 72 720 Td (${esc(pg.title)}) Tj ET\n`;
        pg.body.forEach((line, j) => {
            stream += `BT /F1 13 Tf 72 ${680 - j * 22} Td (${esc(line)}) Tj ET\n`;
        });
        stream += `BT /F1 10 Tf 72 90 Td (Interactive Book Club  -  page ${i + 1} of ${pages.length}) Tj ET\n`;
        objects[page] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contents} 0 R >>`;
        objects[contents] = `<< /Length ${stream.length} >>\nstream\n${stream}endstream`;
    });

    let pdf = `%PDF-1.4\n`;
    const offsets = [];
    for (let n = 1; n < objects.length; n++) {
        offsets[n] = Buffer.byteLength(pdf, 'latin1');
        pdf += `${n} 0 obj\n${objects[n]}\nendobj\n`;
    }
    const xrefStart = Buffer.byteLength(pdf, 'latin1');
    const count = objects.length;
    pdf += `xref\n0 ${count}\n0000000000 65535 f \n`;
    for (let n = 1; n < count; n++) pdf += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
    return Buffer.from(pdf, 'latin1');
}

// Pad a book out to several pages so paging/resume is demonstrable.
const filler = (n, tag) => Array.from({ length: n }, (_, i) =>
    ({ title: `${tag} — chapter ${i + 1}`, body: [
        `This is page ${i + 2} of the sample. Your place here is remembered.`,
        `Close the reader, walk away, come back, and you resume on this page.`,
        `Replace this file with a real book whenever you like.`,
    ]}));

const BOOKS = {
    'welcome.pdf': [
        { title: 'Welcome to the Book Club', body: [
            'A placeholder book, living on a shelf in the Library.',
            'Walk up to a shelf and it opens right here in the world.',
            'The reader remembers which page you were on.',
        ]},
        ...filler(5, 'Getting started'),
    ],
    'field-notes.pdf': [
        { title: 'Field Notes', body: [
            'A second sample, so the shelves have some variety.',
            'Each book tracks its own page independently.',
        ]},
        ...filler(7, 'Notes'),
    ],
    'the-long-one.pdf': [
        { title: 'The Long One', body: [
            'A longer sample to make resume-at-page obviously useful.',
            'Jump around, then reopen — you land back where you stopped.',
        ]},
        ...filler(14, 'Part'),
    ],
};

mkdirSync('src/assets/books', { recursive: true });
for (const [name, pages] of Object.entries(BOOKS)) {
    const buf = buildPdf(pages);
    writeFileSync(`src/assets/books/${name}`, buf);
    console.error(`wrote src/assets/books/${name} (${buf.length} bytes, ${pages.length} pages)`);
}
