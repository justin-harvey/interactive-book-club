// Proves the presence server relays among MANY members (not just 2). Starts the real
// server in-process and connects N WebSocket clients to one room, then checks:
//   1. each member ends up seeing all N-1 others (via snapshot + join broadcasts),
//   2. when one moves, every other member receives the move,
//   3. when one leaves, every other member receives the leave.
// Pure WebSocket (no browser) — the avatar rendering is already covered by verify-presence.
import { WebSocket } from 'ws';

process.env.PRESENCE_PORT = '8148';
await import('../server/presence-server.mjs');
const URL = 'ws://127.0.0.1:8148';
const ROOM = 'town';
const N = 5;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = (m, extra) => { console.error(`FAIL: ${m}`); if (extra) console.error(JSON.stringify(extra, null, 2)); process.exit(1); };

// A member tracks who it currently believes is present (by id).
function member(i) {
    const id = `m${i}`;
    const peers = new Set();
    const moves = [];
    const leaves = [];
    const ws = new WebSocket(URL);
    const m = { id, name: `Member ${i}`, ws, peers, moves, leaves, ready: false };
    ws.on('open', () => {
        ws.send(JSON.stringify({ t: 'hello', room: ROOM, id, name: m.name, x: i, y: 0, facing: 'down' }));
        m.ready = true;
    });
    ws.on('message', (buf) => {
        const msg = JSON.parse(buf.toString());
        if (msg.t === 'snapshot') msg.peers.forEach(p => peers.add(p.id));
        else if (msg.t === 'join') peers.add(msg.peer.id);
        else if (msg.t === 'move') moves.push(msg);
        else if (msg.t === 'leave') { peers.delete(msg.id); leaves.push(msg.id); }
    });
    return m;
}

// Join everyone one at a time so snapshots + joins interleave realistically.
const members = [];
for (let i = 0; i < N; i++) { members.push(member(i)); await sleep(120); }
await sleep(400);

// 1) Everyone sees all the others.
for (const m of members) {
    const others = members.filter(o => o !== m).map(o => o.id).sort();
    const got = [...m.peers].sort();
    if (JSON.stringify(got) !== JSON.stringify(others)) {
        fail(`${m.id} does not see all peers`, { expected: others, got });
    }
}
console.log(`  - all ${N} members see each other (${N * (N - 1)} pairwise links)`);

// 2) m0 moves; everyone else should receive the move.
members.forEach(m => { m.moves.length = 0; });
members[0].ws.send(JSON.stringify({ t: 'move', x: 9, y: 9, facing: 'up' }));
await sleep(300);
for (const m of members.slice(1)) {
    const got = m.moves.find(x => x.id === 'm0' && x.x === 9 && x.y === 9);
    if (!got) fail(`${m.id} did not receive m0's move`, { moves: m.moves });
}
if (members[0].moves.find(x => x.id === 'm0')) fail('m0 received its own move (should not echo)');
console.log(`  - when one member moves, the other ${N - 1} all receive it (no self-echo)`);

// 3) m0 leaves; everyone else should get the leave.
members[0].ws.close();
await sleep(400);
for (const m of members.slice(1)) {
    if (!m.leaves.includes('m0')) fail(`${m.id} did not receive m0's leave`, { leaves: m.leaves });
    if (m.peers.has('m0')) fail(`${m.id} still lists m0 after leave`);
}
console.log(`  - when a member leaves, the other ${N - 1} all see them removed`);

members.slice(1).forEach(m => m.ws.close());
console.log(`PASS: ${N}-member hangout works`);
process.exit(0);
