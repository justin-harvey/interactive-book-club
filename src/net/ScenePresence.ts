// Wires one scene into presence: publishes the local player's position as they walk,
// and drives remote avatars from the server. Scoped by scene key, so the town and each
// interior are separate "rooms" — you only see people in the room you're standing in.
//
// Scenes sleep/wake on switch (not destroyed), so we (de)activate on wake/sleep and
// only tear subscriptions down on shutdown.

import type GameScene from '../Scenes/GameScene';
import { getPresenceClient } from './PresenceClient';
import { RemotePlayers, remoteGid } from './RemotePlayers';
import { ChatBubbles } from '../ui/ChatBubbles';
import { openChatInput, isChatInputOpen } from '../ui/ChatInput';
import { isReaderOpen } from '../ui/BookReader';
import { Emotes } from '../ui/Emotes';
import { showEmoteBar, hideEmoteBar } from '../ui/EmoteBar';
import { showAvatarUi, hideAvatarUi } from '../ui/AvatarPanel';
import { setNowReading as setClubNowReading, getNowReading } from './clubState';
import { getGuestColor, colorToInt, onIdentityChange, setGuestName, setGuestColor } from './identity';

export function attachPresence(scene: GameScene): void {
    const client = getPresenceClient();
    const remotes = new RemotePlayers(scene);
    const bubbles = new ChatBubbles(scene);
    const emotes = new Emotes(scene);
    const room = scene.scene.key;
    let offIdentity: (() => void) | null = null;

    // Tint the local player's avatar with their chosen colour (same as peers see).
    const applyLocalTint = (): void => {
        try { scene.gridEngine.getSprite(scene.playerName)?.setTint(colorToInt(getGuestColor())); } catch { /* ignore */ }
    };

    // Send an emote and pop our own glyph locally (no echo from the server).
    const sendEmote = (glyph: string): void => {
        const sent = client.sendEmote(glyph);
        if (sent) emotes.show(scene.playerName, sent);
    };

    // Open the chat composer (Enter), unless a book/composer is already up.
    const openChat = (): void => {
        if (isChatInputOpen() || isReaderOpen()) return;
        openChatInput(scene, (text) => {
            const sent = client.sendChat(text);
            if (sent) bubbles.show(scene.playerName, sent);   // speaker sees their own bubble
        });
    };

    const stateNow = (): { x: number; y: number; facing: string } => {
        const p = scene.gridEngine.getPosition(scene.playerName);
        const facing = (scene.gridEngine.getFacingDirection(scene.playerName) as unknown as string) || 'down';
        return { x: p.x, y: p.y, facing };
    };

    const activate = (): void => {
        client.enterRoom(room, stateNow(), {
            onSnapshot: peers => remotes.sync(peers),
            onJoin: peer => remotes.upsert(peer),
            onMove: peer => remotes.upsert(peer),
            onLeave: id => { remotes.remove(id); bubbles.remove(remoteGid(id)); },
            onChat: msg => bubbles.show(remoteGid(msg.id), msg.text),
            onEmote: msg => emotes.show(remoteGid(msg.id), msg.e),
            onNowReading: bookId => setClubNowReading(bookId),
        });
        document.addEventListener('keydown', onOpenKey);
        showEmoteBar(sendEmote);
        showAvatarUi(scene);
        applyLocalTint();
        // Changing name/colour (Avatar panel) re-tints us locally and re-announces to peers.
        offIdentity = onIdentityChange(() => { applyLocalTint(); client.reannounce(); });
        // Test hook (opt-in via ?e2e/?debug): expose this scene's presence so automated
        // tests can assert who's visible and inject chat/emotes/identity. Not present in play.
        if (/[?&](e2e|debug)\b/.test(location.search)) {
            (window as any).__ibcPresence = {
                id: client.id, name: client.name, room, remotes, bubbles, emotes,
                say: (text: string) => { const s = client.sendChat(text); if (s) bubbles.show(scene.playerName, s); return s; },
                emote: (glyph: string) => { sendEmote(glyph); return glyph; },
                setReading: (bookId: string) => { setClubNowReading(bookId); client.setNowReading(bookId); return bookId; },
                nowReading: () => getNowReading(),
                setIdentity: (name: string, color: string) => { if (name) setGuestName(name); if (color) setGuestColor(color); return { name, color }; },
            };
        }
    };
    const deactivate = (): void => {
        client.clearHandlers();
        remotes.clear();
        bubbles.clear();
        hideEmoteBar();
        hideAvatarUi();
        offIdentity?.(); offIdentity = null;
        document.removeEventListener('keydown', onOpenKey);
    };

    // Enter opens the composer. Ignored while typing in the composer itself (its own
    // input stops propagation) or any other text field.
    const onOpenKey = (e: KeyboardEvent): void => {
        if (e.key !== 'Enter' || e.repeat) return;
        const el = e.target as HTMLElement | null;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
        e.preventDefault();
        openChat();
    };

    // Publish every completed tile step + every facing change (so idle turns show too).
    const posSub = scene.gridEngine.positionChangeFinished().subscribe(({ charId }: any) => {
        if (charId !== scene.playerName) return;
        const s = stateNow();
        client.publish(s.x, s.y, s.facing);
    });
    const dirSub = scene.gridEngine.directionChanged().subscribe(({ charId, direction }: any) => {
        if (charId !== scene.playerName) return;
        const p = scene.gridEngine.getPosition(scene.playerName);
        client.publish(p.x, p.y, direction as unknown as string);
    });

    activate();
    scene.events.on('wake', activate);
    scene.events.on('sleep', deactivate);
    scene.events.once('shutdown', () => {
        posSub.unsubscribe();
        dirSub.unsubscribe();
        deactivate();
    });
}
