// Interactive Book Club — presence server.
//
// A tiny self-hosted WebSocket server that lets friends see each other move around
// the same room in real time. No cloud: it runs in the same Docker stack on the NAS.
// It only relays ephemeral position state — nothing is stored.
//
// Protocol (JSON text frames):
//   client -> server:
//     { t:'hello', room, id, name, color, x, y, facing } // join a room (or switch rooms)
//     { t:'move', x, y, facing }                     // position update
//     { t:'chat', text }                             // say something in the room
//     { t:'emote', e }                               // react with a small glyph
//     { t:'setreading', bookId }                     // set the club's current pick
//   server -> client:
//     { t:'snapshot', peers:[{id,name,color,x,y,facing}] } // everyone else already here
//     { t:'join',  peer:{id,name,color,x,y,facing} }
//     { t:'move',  id, x, y, facing }
//     { t:'chat',  id, name, text }                  // someone spoke (never echoed back)
//     { t:'emote', id, e }                           // someone reacted (never echoed back)
//     { t:'nowreading', bookId }                     // the club pick (on join + on change)
//     { t:'leave', id }
//
// The club's current "Now Reading" pick is the one piece of SHARED, non-ephemeral state:
// it persists to now-reading.json next to this file (survives restarts, still no cloud)
// and is relayed to every member on join and whenever anyone changes it.
//
// Run: node server/presence-server.mjs   (PORT env, default 8140)

import { WebSocketServer } from 'ws';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Where the shared club pick persists. Defaults to a file next to this server; in Docker
// set NOW_READING_FILE to a path on a mounted volume (e.g. /data/now-reading.json) so it
// survives container rebuilds. See docs/DEPLOY-M6.md.
const STATE_FILE = process.env.NOW_READING_FILE || fileURLToPath(new URL('./now-reading.json', import.meta.url));
let nowReading = '';
try { nowReading = String(JSON.parse(readFileSync(STATE_FILE, 'utf8')).bookId || ''); } catch { /* no file yet */ }

const PORT = Number(process.env.PRESENCE_PORT || process.env.PORT || 8140);
const wss = new WebSocketServer({ port: PORT });

// room -> Map<id, { ws, state }>
const rooms = new Map();

function roomMap(room) {
    let m = rooms.get(room);
    if (!m) { m = new Map(); rooms.set(room, m); }
    return m;
}

function broadcast(room, exceptId, msg) {
    const m = rooms.get(room);
    if (!m) return;
    const data = JSON.stringify(msg);
    for (const [id, entry] of m) {
        if (id === exceptId) continue;
        if (entry.ws.readyState === entry.ws.OPEN) entry.ws.send(data);
    }
}

// Send to every connected member across all rooms (used for the shared club pick,
// which isn't tied to a single room).
function broadcastAll(msg) {
    const data = JSON.stringify(msg);
    for (const [, m] of rooms) {
        for (const [, entry] of m) {
            if (entry.ws.readyState === entry.ws.OPEN) entry.ws.send(data);
        }
    }
}

function leave(conn) {
    if (!conn.room || !conn.id) return;
    const m = rooms.get(conn.room);
    if (m && m.get(conn.id)?.ws === conn.ws) {
        m.delete(conn.id);
        broadcast(conn.room, conn.id, { t: 'leave', id: conn.id });
        if (m.size === 0) rooms.delete(conn.room);
    }
}

function enter(conn, msg) {
    // Switching rooms: drop out of the previous one first.
    if (conn.room && conn.room !== msg.room) leave(conn);

    conn.id = String(msg.id);
    conn.name = String(msg.name || 'Guest');
    conn.room = String(msg.room);
    const color = String(msg.color || '').slice(0, 9);   // '#rrggbb'
    const state = { id: conn.id, name: conn.name, color, x: msg.x | 0, y: msg.y | 0, facing: msg.facing || 'down' };

    const m = roomMap(conn.room);
    // Snapshot of everyone already here, sent only to the newcomer.
    const peers = [];
    for (const [, entry] of m) peers.push(entry.state);
    conn.ws.send(JSON.stringify({ t: 'snapshot', peers }));

    m.set(conn.id, { ws: conn.ws, state });
    broadcast(conn.room, conn.id, { t: 'join', peer: state });

    // Hand the newcomer the current club pick (empty string = none chosen yet).
    conn.ws.send(JSON.stringify({ t: 'nowreading', bookId: nowReading }));
}

function move(conn, msg) {
    if (!conn.room || !conn.id) return;
    const entry = rooms.get(conn.room)?.get(conn.id);
    if (!entry) return;
    entry.state.x = msg.x | 0;
    entry.state.y = msg.y | 0;
    entry.state.facing = msg.facing || entry.state.facing;
    broadcast(conn.room, conn.id, { t: 'move', id: conn.id, x: entry.state.x, y: entry.state.y, facing: entry.state.facing });
}

const CHAT_MAX = 200;

function chat(conn, msg) {
    if (!conn.room || !conn.id) return;
    const text = String(msg.text ?? '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
    if (!text) return;
    // Relay to everyone else in the room; the speaker shows their own bubble locally.
    broadcast(conn.room, conn.id, { t: 'chat', id: conn.id, name: conn.name, text });
}

function emote(conn, msg) {
    if (!conn.room || !conn.id) return;
    // A tiny glyph (an emoji can be a few code units). The client only sends from its
    // own set; the server just bounds the length and relays to everyone else.
    const e = String(msg.e ?? '').trim().slice(0, 8);
    if (!e) return;
    broadcast(conn.room, conn.id, { t: 'emote', id: conn.id, e });
}

function setReading(conn, msg) {
    if (!conn.id) return;
    const bookId = String(msg.bookId ?? '').trim().slice(0, 64);
    if (bookId === nowReading) return;
    nowReading = bookId;
    try { writeFileSync(STATE_FILE, JSON.stringify({ bookId }), 'utf8'); } catch { /* best effort */ }
    broadcastAll({ t: 'nowreading', bookId });   // everyone (incl. the setter) stays in sync
}

wss.on('connection', (ws) => {
    const conn = { ws, id: null, name: null, room: null };
    ws.on('message', (buf) => {
        let msg;
        try { msg = JSON.parse(buf.toString()); } catch { return; }
        if (msg.t === 'hello') enter(conn, msg);
        else if (msg.t === 'move') move(conn, msg);
        else if (msg.t === 'chat') chat(conn, msg);
        else if (msg.t === 'emote') emote(conn, msg);
        else if (msg.t === 'setreading') setReading(conn, msg);
    });
    ws.on('close', () => leave(conn));
    ws.on('error', () => leave(conn));
});

console.log(`[presence] listening on ws://0.0.0.0:${PORT}`);
