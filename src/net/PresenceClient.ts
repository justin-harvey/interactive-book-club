// Client for the self-hosted presence server (server/presence-server.mjs). One
// WebSocket for the whole game (singleton); scenes just switch which "room" they're
// in. Reconnects with backoff and re-announces the current room on reconnect.
//
// Server URL resolution (first match wins):
//   1. window.__IBC_PRESENCE_URL   (set by tests / a deploy config)
//   2. ws(s)://<page-host>/presence (if a reverse proxy routes /presence -> server)
//   3. ws://<page-hostname>:8140    (dev / direct)
// Presence is optional: if the server is unreachable the game runs fine solo.

import { getGuestId, getGuestName, getGuestColor, getGuestCharacter } from './identity';

export interface Peer { id: string; name: string; x: number; y: number; facing: string; color?: string; character?: string; }

export interface ChatMsg { id: string; name: string; text: string; }
export interface EmoteMsg { id: string; e: string; }

export interface RoomHandlers {
    onSnapshot?: (peers: Peer[]) => void;
    onJoin?: (peer: Peer) => void;
    onMove?: (peer: Peer) => void;
    onLeave?: (id: string) => void;
    onChat?: (msg: ChatMsg) => void;
    onEmote?: (msg: EmoteMsg) => void;
    onNowReading?: (bookId: string) => void;
}

function resolveUrl(): string {
    const w = window as any;
    if (typeof w.__IBC_PRESENCE_URL === 'string' && w.__IBC_PRESENCE_URL) return w.__IBC_PRESENCE_URL;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (location.host && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        return `${proto}//${location.host}/presence`;
    }
    return `ws://${location.hostname || 'localhost'}:8140`;
}

class PresenceClient {
    private ws: WebSocket | null = null;
    private url = '';
    private connected = false;
    private backoff = 500;

    private room: string | null = null;
    private self = { x: 0, y: 0, facing: 'down' };
    private handlers: RoomHandlers = {};

    readonly id = getGuestId();
    get name(): string { return getGuestName(); }
    get color(): string { return getGuestColor(); }
    get character(): string { return getGuestCharacter(); }

    private ensure(): void {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
        try {
            this.url = resolveUrl();
            this.ws = new WebSocket(this.url);
        } catch {
            this.scheduleReconnect();
            return;
        }
        this.ws.onopen = () => {
            this.connected = true;
            this.backoff = 500;
            if (this.room) this.sendHello();
        };
        this.ws.onclose = () => { this.connected = false; this.ws = null; this.scheduleReconnect(); };
        this.ws.onerror = () => { try { this.ws?.close(); } catch { /* ignore */ } };
        this.ws.onmessage = (ev) => this.onMessage(ev);
    }

    private scheduleReconnect(): void {
        if (!this.room) return;   // nothing to maintain
        setTimeout(() => this.ensure(), this.backoff);
        this.backoff = Math.min(this.backoff * 2, 10000);
    }

    private send(obj: unknown): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try { this.ws.send(JSON.stringify(obj)); } catch { /* ignore */ }
        }
    }

    private sendHello(): void {
        this.send({ t: 'hello', room: this.room, id: this.id, name: this.name, color: this.color, character: this.character, ...this.self });
    }

    // Re-announce the current identity to the room (after a name/colour change), so peers
    // update their view of us. Safe no-op if we're not in a room yet.
    reannounce(): void {
        if (this.room) this.sendHello();
    }

    private onMessage(ev: MessageEvent): void {
        let msg: any;
        try { msg = JSON.parse(ev.data); } catch { return; }
        switch (msg.t) {
            case 'snapshot': this.handlers.onSnapshot?.(msg.peers || []); break;
            case 'join': this.handlers.onJoin?.(msg.peer); break;
            case 'move': this.handlers.onMove?.({ id: msg.id, name: '', x: msg.x, y: msg.y, facing: msg.facing }); break;  // no name/colour on move frames
            case 'chat': this.handlers.onChat?.({ id: msg.id, name: msg.name || 'Guest', text: String(msg.text || '') }); break;
            case 'emote': this.handlers.onEmote?.({ id: msg.id, e: String(msg.e || '') }); break;
            case 'nowreading': this.handlers.onNowReading?.(String(msg.bookId || '')); break;
            case 'leave': this.handlers.onLeave?.(msg.id); break;
        }
    }

    // Enter (or switch to) a room. `state` is the player's current position. Replaces
    // any previous room's handlers — only the active scene listens.
    enterRoom(room: string, state: { x: number; y: number; facing: string }, handlers: RoomHandlers): void {
        this.room = room;
        this.self = { ...state };
        this.handlers = handlers;
        this.ensure();
        this.sendHello();
    }

    // Stop listening for the current scene (on sleep/shutdown). Keeps the socket.
    clearHandlers(): void {
        this.handlers = {};
    }

    publish(x: number, y: number, facing: string): void {
        this.self = { x, y, facing };
        if (this.connected) this.send({ t: 'move', x, y, facing });
    }

    // Say something in the current room. The server relays it to everyone else;
    // the speaker renders their own bubble locally (no echo), so this returns the
    // trimmed text for immediate local display (or '' if there was nothing to send).
    sendChat(text: string): string {
        const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
        if (clean) this.send({ t: 'chat', text: clean });
        return clean;
    }

    // React with a small glyph. Relayed to everyone else; the sender shows their own
    // locally (no echo). Returns the trimmed glyph for immediate local display.
    sendEmote(e: string): string {
        const clean = String(e || '').trim().slice(0, 8);
        if (clean) this.send({ t: 'emote', e: clean });
        return clean;
    }

    // Set the club's shared "Now Reading" pick. The server persists it and relays
    // the new value to everyone (including us), so the sign stays in sync.
    setNowReading(bookId: string): void {
        this.send({ t: 'setreading', bookId: String(bookId || '').slice(0, 64) });
    }
}

let client: PresenceClient | null = null;
export function getPresenceClient(): PresenceClient {
    if (!client) client = new PresenceClient();
    return client;
}
