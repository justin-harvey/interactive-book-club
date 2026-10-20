// The in-world book reader. A full-screen panel over the Phaser canvas that renders
// a PDF with PDF.js onto a canvas we own — so, unlike the browser's native viewer, we
// know the current page and can remember it. Pure DOM, like LeaveButton. Opened by a
// Bookshelf when the player steps up to it.
//
// Page memory: the last page of each book is stored in localStorage keyed by book id
// (`ibc:page:<id>`), restored on open. M4 will sync this per-member to Firebase.
//
// PDF.js is the vendored legacy UMD build (assets/vendor/pdfjs/), loaded on demand via
// a <script> tag so it stays out of the game's es5 rollup bundle.

import 'phaser';
import type { Book } from '../data/books';

const PDFJS_SRC = 'assets/vendor/pdfjs/pdf.js';
const PDFJS_WORKER = 'assets/vendor/pdfjs/pdf.worker.js';
const pageKey = (id: string): string => `ibc:page:${id}`;

let overlay: HTMLDivElement | null = null;
let titleEl: HTMLSpanElement | null = null;
let pageEl: HTMLSpanElement | null = null;
let canvas: HTMLCanvasElement | null = null;
let stage: HTMLDivElement | null = null;
let prevBtn: HTMLButtonElement | null = null;
let nextBtn: HTMLButtonElement | null = null;

let onClose: (() => void) | null = null;
let activeScene: Phaser.Scene | null = null;
let isOpen = false;

let pdfLibPromise: Promise<any> | null = null;
let doc: any = null;              // current PDFDocumentProxy
let currentBook: Book | null = null;
let currentPage = 1;
let numPages = 1;
let rendering = false;
let pendingPage: number | null = null;   // coalesce re-render requests

export function isReaderOpen(): boolean {
    return isOpen;
}

// Load the vendored PDF.js once.
function loadPdfJs(): Promise<any> {
    if (pdfLibPromise) return pdfLibPromise;
    pdfLibPromise = new Promise((resolve, reject) => {
        const w = window as any;
        if (w.pdfjsLib) { w.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; resolve(w.pdfjsLib); return; }
        const s = document.createElement('script');
        s.src = PDFJS_SRC;
        s.onload = () => {
            const lib = (window as any).pdfjsLib;
            if (!lib) { reject(new Error('pdf.js failed to expose pdfjsLib')); return; }
            lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
            resolve(lib);
        };
        s.onerror = () => reject(new Error('pdf.js script failed to load'));
        document.head.appendChild(s);
    });
    return pdfLibPromise;
}

function ensure(): void {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'book-reader';
    overlay.className = 'book-reader';
    overlay.innerHTML = `
        <div class="book-reader__bar">
            <span class="book-reader__title"></span>
            <span class="book-reader__spacer"></span>
            <button class="book-reader__nav" data-dir="prev" aria-label="Previous page">‹</button>
            <span class="book-reader__page">–</span>
            <button class="book-reader__nav" data-dir="next" aria-label="Next page">›</button>
            <button class="book-reader__close" aria-label="Close book">Close &times;</button>
        </div>
        <div class="book-reader__stage"><canvas class="book-reader__canvas"></canvas></div>
    `;
    titleEl = overlay.querySelector('.book-reader__title');
    pageEl = overlay.querySelector('.book-reader__page');
    canvas = overlay.querySelector('.book-reader__canvas');
    stage = overlay.querySelector('.book-reader__stage');
    prevBtn = overlay.querySelector('[data-dir="prev"]');
    nextBtn = overlay.querySelector('[data-dir="next"]');

    prevBtn!.addEventListener('click', () => go(currentPage - 1));
    nextBtn!.addEventListener('click', () => go(currentPage + 1));
    overlay.querySelector('.book-reader__close')!.addEventListener('click', () => closeBookReader());
    document.body.appendChild(overlay);
}

// Arrow keys page the book while it's open (the game's keyboard is disabled).
function onKey(e: KeyboardEvent): void {
    if (!isOpen) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(currentPage - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(currentPage + 1); }
    else if (e.key === 'Escape') { e.preventDefault(); closeBookReader(); }
}
let resizeTimer: number | undefined;
function onResize(): void {
    if (!isOpen) return;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => renderPage(currentPage), 120);
}

function updateControls(): void {
    if (pageEl) pageEl.textContent = `${currentPage} / ${numPages}`;
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= numPages;
}

function go(page: number): void {
    const p = Math.min(Math.max(page, 1), numPages);
    if (p === currentPage) return;
    currentPage = p;
    if (currentBook) { try { localStorage.setItem(pageKey(currentBook.id), String(p)); } catch { /* ignore */ } }
    updateControls();
    renderPage(p);
}

async function renderPage(page: number): Promise<void> {
    if (!doc || !canvas || !stage) return;
    if (rendering) { pendingPage = page; return; }   // one render at a time
    rendering = true;
    try {
        const pg = await doc.getPage(page);
        const unscaled = pg.getViewport({ scale: 1 });
        // Fit the page to the stage width (accounting for device pixels for crispness).
        const avail = Math.max(stage.clientWidth - 8, 200);
        const cssScale = avail / unscaled.width;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = pg.getViewport({ scale: cssScale * dpr });
        const ctx = canvas.getContext('2d')!;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
        await pg.render({ canvasContext: ctx, viewport }).promise;
    } catch (err) {
        console.warn('BookReader: render failed', err);
    } finally {
        rendering = false;
        if (pendingPage !== null) { const p = pendingPage; pendingPage = null; renderPage(p); }
    }
}

// Open a book. `scene` is the Library scene (its keyboard is disabled while reading);
// `onDone` re-arms the shelf when the reader closes.
export async function openBookReader(book: Book, scene: Phaser.Scene, onDone?: () => void): Promise<void> {
    ensure();
    if (isOpen) return;
    isOpen = true;
    activeScene = scene;
    onClose = onDone ?? null;
    currentBook = book;

    titleEl!.textContent = book.author ? `${book.title} — ${book.author}` : book.title;
    if (pageEl) pageEl.textContent = '…';
    overlay!.style.display = 'flex';

    const kb = scene.input?.keyboard;
    if (kb) kb.enabled = false;
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);

    try {
        const lib = await loadPdfJs();
        // A stale close may have happened while loading.
        if (!isOpen || currentBook !== book) return;
        doc = await lib.getDocument(book.file).promise;
        numPages = doc.numPages || 1;
        let start = parseInt(localStorage.getItem(pageKey(book.id)) || '1', 10);
        if (!Number.isFinite(start)) start = 1;
        currentPage = Math.min(Math.max(start, 1), numPages);
        updateControls();
        await renderPage(currentPage);
    } catch (err) {
        console.warn('BookReader: failed to open', book.file, err);
        if (pageEl) pageEl.textContent = '!';
    }
}

export function closeBookReader(): void {
    if (!isOpen) return;
    isOpen = false;
    if (currentBook) { try { localStorage.setItem(pageKey(currentBook.id), String(currentPage)); } catch { /* ignore */ } }
    if (overlay) overlay.style.display = 'none';

    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);

    if (doc) { try { doc.destroy(); } catch { /* ignore */ } doc = null; }
    currentBook = null;
    pendingPage = null;

    const kb = activeScene?.input?.keyboard;
    if (kb) kb.enabled = true;
    activeScene = null;

    const cb = onClose;
    onClose = null;
    cb?.();
}
