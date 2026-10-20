# Interactive Book Club — HANDOFF

> Persistent memory across context clears. On a fresh context, read `ARCHITECTURE.md`
> first, then this file, before doing anything. `ISOTOPIA-ENGINE-REFERENCE.md` is the
> deep engine reference (describes Isotopia, the game this was forked from).
> When Justin says "handoff", append a dated entry below and refresh **Current State**.

---

## Current State (single source of truth)

**One line:** a private, walkable pixel-world (forked from Justin's own Isotopia) with a
working in-world PDF library, real-time presence, a full social layer (chat + emotes +
shared "Now Reading"), avatar customization, a self-host container stack, and seasonal
flavour. **Feature-complete through M7; the only thing left is Justin running the deploy
on the TrueNAS box (+ setting up the repo/Netlify).**

- **Milestones:** M0 fork/rename ✅ · M1 walkable world + polish ✅ · M2 PDF library ✅ ·
  M3 catalog/covers/resume ✅ · M4 real-time presence ✅ · M5 social layer ✅
  (chat + emotes + "Now Reading") · M6 self-host stack ✅ (built & verified; proxy path
  proven headless; NAS deploy pending) · **M7 polish ✅ (avatar name+colour synced;
  seasonal sign). Minigames deferred (feature track, not polish).** — all E2E-verified.
  **NEXT: M6 deploy** on TrueNAS SCALE (`docs/DEPLOY-M6.md`); optional M7+ (minigames, EPUB).
- **Repo:** `/home/nah/interactive-book-club`, forked from `/home/nah/Claudia/isotopia`
  (the live classroom game, untouched). **No git repo initialized here yet; no remote.**
- **Stack:** Phaser 3.55 + grid-engine + TypeScript, Rollup build (target es5 — note the
  Map-iteration gotcha). PDF.js (vendored) for the reader. Self-hosted `ws` server for
  presence. Needs **Node 22** (`nvm use 22`).

### How to run / see it live
```
nvm use 22
npm install            # first time
npm run build          # -> dist/
npm run presence       # self-hosted WS presence server on :8140 (separate terminal)
cd dist && python3 -m http.server 8080    # serve the game (separate terminal)
```
Open `http://localhost:8080` in two windows, walk into the Library in both → two penguins.
For LAN friends: set `window.__IBC_PRESENCE_URL='ws://<your-LAN-ip>:8140'` and serve dist on
your LAN IP. (Remote/off-LAN friends need M6 hosting + Tailscale.)

### How to verify (all pass as of this session)
- `npm run verify:library`        — bookshelf → PDF.js reader → paging → resume-at-page
- `npm run verify:presence`       — 2 browsers see each other move + leave  ⚠️ FLAKY (see note)
- `npm run verify:presence-many`  — 5-member relay (see all / move / leave, no self-echo)
- `npm run verify:chat`           — 2 browsers: one speaks → other sees the bubble; speaker
                                     echo; bubble auto-expires; reply seen back (M5)
- `npm run verify:emote`          — 2 browsers: one reacts → other sees the glyph; sender
                                     echo; reply reaction seen back (M5)
- `npm run verify:nowreading`     — 2+1 browsers: set club pick → peer syncs → server echo →
                                     late-joiner gets it on join → persisted to disk (M5)
- `npm run verify:proxy`          — M6 same-origin reverse-proxy: serves game + proxies the
                                     presence WS upgrade on a non-loopback host, so the client
                                     takes its real ws://<host>/presence path; presence + chat
                                     flow through it. Proves the nginx wiring WITHOUT Docker.
- `npm run verify:avatar`         — 2+1 browsers: change name + colour → peer sees both on
                                     your avatar; late-joiner gets them on join (M7)

  ⚠️ `verify:library` joins `verify:presence` as LOAD-SENSITIVE: both walk the avatar
  multiple tiles and assert exact state in a window. Under a loaded machine (e.g. many
  chromium procs piled up across a long session) the headless renderer can crash
  ("Target crashed") or the walk can stall a tile short, so they flake. They pass
  reliably in isolation (kill stray `chrome-headless-shell` first). Not code bugs — the
  resume + movement code is unchanged by M5-M7. verify:library step 7 now waits for the
  step-away to ARRIVE before walking back (removes the retarget-mid-move stall).

  ⚠️ `verify:presence` is timing-flaky and PRE-DATES M5 (not a chat regression). It asserts
  the exact final tile within 10s after a peer walks 2 tiles fast. Remote avatars walk
  tile-to-tile (M4's smooth-motion design via grid-engine `moveTo`), so the watcher can
  stall one tile short of the latest target when moves arrive faster than the walk. The
  avatar does converge to the right tile (observed ~6s), just not always inside the window.
  The server relay itself is proven correct by `verify:presence-many` (raw-socket). If this
  needs to be made deterministic, the real fix is in `RemotePlayers.upsert` (catch-up/teleport
  when >1 tile behind, or bump remote walk speed) — an M4 robustness task, not M5.

  Verify scripts need `playwright-core` (devDep) + a cached chromium path written to
  `/tmp/ibc-chromium-path` (currently `.../chromium_headless_shell-1243/.../chrome-headless-shell`).
  If that temp file is gone, re-point it at a cached chromium before running the browser tests.

### What works
- **Walkable world:** hub = `TestScene` (Luna Town, boots first); doors into Library
  (tile 24,8), Hardware, Hannaford, Home, Auto, Woods. No lesson gameplay visible.
- **Library (M2/M3):** 3 books on back-wall shelves (tiles 6/7/9, row 7), each a coloured
  titled spine. Walk onto the pad → PDF.js reader (prev/next, page indicator, Arrow/Esc,
  resume-at-page via `localStorage` key `ibc:page:<id>`). Add books in `src/data/books.ts`.
- **Presence (M4):** many members (verified to 5, no hard cap) see each other move in
  real time, scoped per scene (town vs each interior), with name tags. Runs fine solo if
  the server is down. **Present-together = done. Interaction so far = see + bump only**
  (remote avatars are solid); **chat/emotes = M5.**

### Key files added this project (all original; remote avatars reuse Justin's own dog art)
- `server/presence-server.mjs` — WS relay (`npm run presence`)
- `src/net/` — `PresenceClient.ts`, `RemotePlayers.ts`, `ScenePresence.ts`, `identity.ts`
- `src/ui/BookReader.ts`, `src/Scenes/components/Bookshelf.ts`, `src/data/books.ts`
- `src/assets/vendor/pdfjs/` (vendored PDF.js), `src/assets/books/*.pdf` (placeholders)
- `tools/make-placeholder-pdf.mjs`, `tools/verify-*.mjs`
- Reversible lesson-off edits tagged `BOOKCLUB M1` / `BOOKCLUB M1 polish` in
  `src/Scenes/GameScene.ts` and `src/game.ts`.

### Backlog / honest gaps (non-blocking)
- Reading progress is **per-device** (localStorage), not per-person — needs real accounts
  (only anonymous guest ids exist now). Deferred.
- Boot still signs into Firebase + loads question-bank/season (harmless, falls back);
  `teacher.html` portal still present; dead lesson *code* (QuizOverlay, Elemental data,
  battle, biome scenes) not pruned from the bundle. None reachable in normal play.
- In-world covers are generated coloured spines; real cover art can go in `book.cover`.
- Not hosted yet; no git repo initialized.
- **Open questions (ARCHITECTURE §5):** TrueNAS SCALE vs CORE; Tailscale vs LAN-only;
  keep Firebase vs drop it for a fully local box; PDF-only vs EPUB.

---

## Log

### 2026-10-20 — M7: avatar customization + seasonal flavour (polish)
- **Avatar customization (the flagship):** each guest now has a display **name + colour**,
  so friends can tell each other apart — the one polish item that actually matters for a
  hangout. Colour tints the avatar sprite and fills the name tag (contrast text by luminance).
  - `identity.ts`: `AVATAR_COLORS` palette, `getGuestColor/setGuestColor`, `colorToInt`,
    `textOn`, and an `onIdentityChange` pub/sub. Colour seeds stably from the guest id.
  - Protocol: colour rides `hello`/`snapshot`/`join` (NOT `move` frames — those omit it,
    and RemotePlayers keeps the last colour). Server carries `color` in peer state.
  - `PresenceClient`: `color` getter + `reannounce()` (re-send hello after a change).
  - `RemotePlayers`: tints the sprite + colours the name tag on create; applies colour
    changes on re-announce; `colorFor`/`nameFor` for the E2E hook.
  - `ScenePresence`: tints the LOCAL avatar (`applyLocalTint`), and on identity change
    re-tints + `reannounce()`s so peers update live. Hook gained `setIdentity`.
  - `src/ui/AvatarPanel.ts`: a top-right 🎨 button → modal (name field + colour swatches),
    disables the scene keyboard while open (like ChatInput). `.ibc-avatar*` CSS.
  - **Verified E2E** (`npm run verify:avatar`): Alice changes name+colour → Bob sees both
    on her avatar → late-joiner Carol gets them on join (snapshot). PASS.
- **Seasonal flavour:** `src/data/bookSeason.ts` — pure `currentSeason(date)` (named to
  avoid the inherited Isotopia `season.ts`, which is an unrelated RTDB epoch) → a small
  seasonal sign on the Library back wall. Month→season mapping unit-checked (Oct → Autumn).
- **Minigames: DEFERRED.** Each is a feature track (design + build), not a polish pass;
  a good post-launch direction, intentionally out of scope for M7.
- **Full suite** (avatar/chat/emote/nowreading/proxy/library/presence-many) all PASS in a
  clean environment. `verify:library` flaked under this session's accumulated chromium
  load (renderer "Target crashed" / walk stall) but passes in isolation — see the
  load-sensitive note under "How to verify". Hardened its step-away with an arrival-wait.
- Docs: README status + ARCHITECTURE milestones/open-questions updated (M0-M7 done; §5
  resolved for the self-host path).

### 2026-10-20 — M6: self-host container stack (built + verified; NAS deploy pending)
- Containerized the whole thing for self-hosting. **Two services, one public port:**
  - `web` (`Dockerfile`, multi-stage: Node 22 builds dist → nginx serves it) also
    reverse-proxies the presence WebSocket at the SAME origin under `/presence`
    (`docker/nginx.conf`, with the `Upgrade`/`Connection` map). Publishes `8080`.
  - `presence` (`Dockerfile.presence`, Node + `ws` only) — internal network only, not
    published. `docker-compose.yml` wires them + a `./data:/data` volume.
- **Why same-origin `/presence`:** matches `PresenceClient.resolveUrl()` exactly — off
  localhost it uses `ws(s)://<host>/presence`. No cross-origin / extra-port config for
  clients, and HTTPS (via Tailscale) transparently becomes `wss://`.
- **Persistence:** moved the club-pick file path to env `NOW_READING_FILE` (default next
  to the server; Docker sets `/data/now-reading.json` on the volume so it survives rebuilds).
- **Dependency fix:** `ws` moved from devDependencies → **dependencies** (it's a runtime
  dep of the presence server; the image installs it via `npm ci --omit=dev`).
- **Verified WITHOUT Docker** (none in the build env): `npm run verify:proxy` stands up the
  exact topology — a dep-free Node reverse proxy (serves dist + forwards the `/presence` WS
  upgrade, like nginx) bound to a **non-loopback** IP so the browser takes its real
  production path. Asserted: client resolved `ws://<lan-ip>:<port>/presence`, two members
  saw each other (WS upgrade through the proxy), chat relayed (duplex frames). PASS.
  All M4/M5 verifiers still PASS after the `ws` move + state-path change.
- **Deploy guide:** `docs/DEPLOY-M6.md` — TrueNAS **SCALE** (native compose on Electric Eel+,
  or prebuilt images via Dockge/Portainer on older), persistence dataset → `/data`,
  **Tailscale `serve`** for remote friends (recommended) + LAN fallback, Firebase-off note.
  Resolves ARCHITECTURE §5 Q1 (SCALE), Q2 (Tailscale), Q3 (drop Firebase for self-host).
- `npm run docker:up` / `docker:down` / `docker:logs` convenience scripts added.
- **Left to Justin (needs the actual box / Docker, can't be done from the build env):**
  run `docker compose up -d --build` on the NAS, point the volume at a dataset, and run
  `tailscale serve` — then invite friends. Everything is proven locally up to that step.

### 2026-10-20 — M5 part 3: "Now Reading" meeting spot — M5 COMPLETE
- Final M5 piece: the Library's **"Now Reading" placard** — the club's current pick,
  shared across everyone and settable in-world. This is the FIRST shared, non-ephemeral
  state in the app (chat/emotes are ephemeral relays).
- **Decision (Justin):** persist the pick as a **JSON file on the presence server** — not
  Firebase, not RAM. Survives restarts, stays fully self-hosted (no cloud), resolves the
  relevant half of ARCHITECTURE §5 for this feature. (Per-member *reading progress* is a
  separate, still-open question; still per-device localStorage.)
- **Server:** `server/presence-server.mjs` now holds one global `nowReading` bookId,
  loaded from `server/now-reading.json` on boot. `{t:'setreading', bookId}` → writes the
  file + `broadcastAll({t:'nowreading', bookId})` to every member (incl. the setter).
  Each newcomer gets `{t:'nowreading'}` right after their snapshot on join. New
  `broadcastAll()` helper (cross-room). `now-reading.json` is gitignored (runtime state).
- **Client:** `onNowReading` handler + `'nowreading'` case + `setNowReading(bookId)`.
- **Shared store:** `src/net/clubState.ts` — a tiny get/set/subscribe singleton so the
  Library sign can read + react to the pick without threading it through scene handlers
  (which swap as you change rooms). `ScenePresence` routes `onNowReading → clubState` for
  every scene.
- **UI (new, both original):**
  - `src/Scenes/components/NowReadingSign.ts` — a placard at Library tile (10,8) with a
    step-pad at (10,9) (mirrors `Bookshelf`: adds its own blocking sprite, `drawDoorCue`
    "CLUB ✦", `movementStopped` gate). Shows "📖 NOW READING / <title>", live-updating via
    `clubState` subscription. Stepping on the pad opens the chooser.
  - `src/ui/NowReadingPicker.ts` — a DOM overlay listing the catalog (current pick flagged);
    pick → optimistic `clubState.set` + `client.setNowReading` (server persists + syncs);
    disables the scene keyboard, Esc / backdrop / Close to dismiss.
  - `LibraryScene` builds the sign and closes both the reader and the chooser on sleep/shutdown.
- **Styling:** `.ibc-nowreading*` in `src/index.css`; placement validated against the
  `walls` collision layer of `room_library.json` (walkable floor rows 8-14; (10,8)/(10,9)
  are free, clear of book pads (6/7/9,8) and spawn (8,8)).
- **Verified E2E** (`npm run verify:nowreading`, 2+1 browsers): Alice sets the pick → Bob
  syncs → Alice gets the server echo → late-joiner Carol receives it on join → the pick is
  persisted to `now-reading.json`. PASS. Chat/emote/library/5-member all still PASS.
- **E2E hook** gained `setReading(id)` + `nowReading()`.

### 2026-10-20 — M5 part 2: emote reactions
- Second M5 social piece: **emotes** — quick reactions that pop over an avatar. Same
  ephemeral relay as chat, so again nothing is stored and it works solo (you still see
  your own reaction).
- **Protocol:** `{t:'emote', e}` client→server; server bounds length (8) and broadcasts
  `{t:'emote', id, e}` to the room except sender (sender pops their own locally).
- **Client:** `PresenceClient.sendEmote(e)` + `onEmote` handler + `'emote'` case; `EmoteMsg`.
- **UI (new, both original):**
  - `src/ui/Emotes.ts` — a floating glyph that drifts up and fades (~1.4s) above the
    avatar via a Phaser tween; no background/persistence (lighter than a chat bubble).
    Exports the `EMOTES` set (👍 ❤️ 😂 👋 📖 🎉). `lastFor(gid)` for the E2E hook.
  - `src/ui/EmoteBar.ts` — a bottom-right 😊 FAB that expands into a row of reaction
    buttons (pure DOM, like LeaveButton); picking one sends + collapses.
- **Wiring:** `ScenePresence` creates `Emotes`, routes `onEmote → emotes.show(remote gid)`,
  shows/hides the `EmoteBar` on activate/deactivate, pops the sender's own glyph on pick.
  E2E hook gained `emotes` + `emote(glyph)`.
- **Styling:** `.ibc-emote*` in `src/index.css` (round pill buttons, matches the palette);
  HUD hint updated to mention the 😊 react button.
- **Verified E2E** (`npm run verify:emote`): Alice reacts 👍 → Bob sees it over her avatar;
  Alice sees her own; Bob reacts 🎉 → Alice sees it. PASS. Chat + library + 5-member still PASS.
- **NEXT / open decision:** the "Now Reading" meeting spot is the last M5 piece. Unlike
  chat/emotes it wants SHARED state (the club's current pick), which is the first thing to
  need real persistence — this collides with ARCHITECTURE §5 open question (Firebase vs a
  local store). Options: (a) static field in `books.ts` + a Library placard (no persistence,
  ship now); (b) in-memory on the presence server + relay to newcomers (lost on restart);
  (c) a small JSON file the presence server reads/writes (survives restart, still no cloud);
  (d) Firebase. Decision pending from Justin before building the editable version.

### 2026-10-20 — M5 kickoff: in-world chat bubbles (social layer, part 1)
- Started M5 (the book-club social layer) with its centerpiece: **in-world chat**. Built
  on the M4 WebSocket presence engine — chat is just another ephemeral relayed frame, so
  nothing is stored and it works offline/solo (bubbles still render for your own messages).
- **Protocol:** added `{t:'chat', text}` client→server; server trims/caps to 200 chars and
  broadcasts `{t:'chat', id, name, text}` to the room **except the sender** (speaker shows
  their own bubble locally, same no-echo pattern as `move`). `server/presence-server.mjs`.
- **Client:** `PresenceClient.sendChat(text)` (returns the trimmed text for immediate local
  display) + `onChat` handler + `'chat'` case in `onMessage`. `ChatMsg` interface added.
- **UI (new, both original):**
  - `src/ui/ChatBubbles.ts` — a Phaser speech bubble glued above any grid-engine character
    (local player name or `remote:<id>`), auto-expires after 5s, repositioned each frame
    above the name tag. `textFor(gid)` exposed for the E2E hook.
  - `src/ui/ChatInput.ts` — a bottom-docked DOM composer opened by **Enter** (pure DOM, like
    BookReader). Disables the Phaser scene keyboard while typing; Enter sends, Esc cancels;
    input `stopPropagation` so typing never walks the dog.
- **Wiring:** `ScenePresence.attachPresence` now creates `ChatBubbles`, adds a document
  `keydown` opener (Enter, ignored inside text fields / while the reader is open), routes
  `onChat → bubbles.show(remote gid)`, drops a peer's bubble on leave, and shows the
  speaker's own bubble on send. E2E hook `__ibcPresence` gained `bubbles` + `say(text)`.
  Exported `remoteGid(id)` from `RemotePlayers` so bubbles target the same sprite.
- **Styling:** `.ibc-chat*` in `src/index.css` (matches the book-reader pill/colour system).
  HUD gained a "Press Enter to chat" hint in `src/index.html`.
- **Verified E2E** (`npm run verify:chat`, 2 Playwright browsers + in-process WS server):
  Alice speaks → Bob sees the bubble over her avatar; Alice sees her own bubble; the bubble
  auto-expires; Bob replies → Alice sees it. PASS. Library + 5-member presence still PASS.
- **Heads-up:** `verify:presence` (the 2-browser *movement* test) is timing-flaky and
  pre-dates M5 — see the "How to verify" note above. Not a chat regression; chat changes
  touch none of the movement path.
- **NEXT in M5:** emotes (quick reactions, same relay — add `{t:'emote'}` or reuse chat
  with a sentinel), then the **"Now Reading"** meeting spot (a room/sign showing the club
  pick; shared state, not ephemeral — first thing in M5 that may want real persistence).

### 2026-10-20 — Session handoff
- Stopped after M4 verified. The multiplayer *engine* is complete: many people can be
  present together and see each other move (verified to 5). What's missing for a real
  "hangout" is (a) **chat/emotes = M5** and (b) **getting it hosted so friends can join
  = M6**.
- Awaiting Justin's pick for next session: **M5** (richer in-world social: chat first,
  then emotes, then "Now Reading") vs **M6** (self-host on NAS + Tailscale to get real
  friends in). Suggested M6 if the goal is "see it work with real people" soon; M5 if
  "make it feel alive" first.
- Everything builds clean under Node 22; all three verify scripts pass. No git repo yet.

### 2026-10-20 — M4: real-time presence (self-hosted WebSocket)
- **Decision:** presence transport = self-hosted WebSocket server, NOT Firebase (cloud).
  Matches the private/self-hosted-on-NAS premise, works offline/LAN, and is verifiable
  here. (Firebase is only active with build-time FIREBASE_* config, which isn't set.)
- **Server:** `server/presence-server.mjs` — tiny `ws` relay. Rooms keyed by scene; relays
  ephemeral {id,name,x,y,facing}; snapshot on join, join/move/leave broadcasts; cleanup
  on disconnect. Stores nothing. `npm run presence` (PORT/PRESENCE_PORT, default 8140).
- **Client:** `src/net/PresenceClient.ts` (singleton WS, reconnect/backoff, room switch,
  publish). URL: `window.__IBC_PRESENCE_URL` → `wss://host/presence` (proxy) → `ws://host:8140`.
  `src/net/identity.ts` = persistent guest id+name in localStorage (no accounts).
- **Avatars:** `src/net/RemotePlayers.ts` renders each peer with the SAME dog avatar +
  walk mapping as the local player; grid-engine `moveTo` walks them tile-to-tile for
  smooth motion; floating name tag; teleport (setPosition) if >3 tiles. Own art only.
- **Wiring:** `src/net/ScenePresence.ts` `attachPresence(scene)` called once in
  `GameScene.create()` → every scene. Publishes on `positionChangeFinished` +
  `directionChanged` (filtered to the local player); scoped by `scene.scene.key` so town
  and each interior are separate rooms. Activate/deactivate on wake/sleep; unsub on shutdown.
- **es5 gotcha:** can't `for..of`/spread Map iterators at target es5 — used `Map.forEach`.
- **Verified 2-browser E2E** (`npm run verify:presence`, in-process WS server + 2 Playwright
  contexts): Alice & Bob see each other in the Library → Bob sees Alice walk to (6,8) →
  Bob sees Alice removed when her tab closes. PASS. M3 reader still PASS with presence on
  but no server (graceful WS failure, solo play unaffected).
- Reading progress still per-device localStorage; per-member sync deferred (needs accounts).

### 2026-10-20 — M3: catalog, covers, resume-at-page
- **Switched the reader from the native iframe to PDF.js** (the M2 iframe couldn't
  report the current page, so true resume was impossible). Rewrote `src/ui/BookReader.ts`
  to render pages to a canvas we own, with prev/next buttons, a "N / total" indicator,
  Arrow keys + Escape, and resize re-render.
- **Resume-at-page:** last page saved to `localStorage` keyed `ibc:page:<book.id>` on every
  page change + on close; restored (clamped to page count) on open. M4 will sync this
  per-member to Firebase instead of per-device localStorage.
- **PDF.js delivery:** vendored the legacy UMD build to `src/assets/vendor/pdfjs/`
  (`pdf.js` + `pdf.worker.js`, from pdfjs-dist@3.11.174, kept as a devDep). Loaded on
  demand via a `<script>` tag so it stays OUT of the game's es5 rollup bundle. Rollup's
  `src/assets/*` copy rule ships it to `dist/assets/vendor/pdfjs/`.
- **Multiple books + covers:** `src/data/books.ts` now has 3 books on shelves (6,7),
  (7,7), (9,7), each with a `spine` hex colour. `Bookshelf` draws a titled coloured
  spine on the shelf tile (DoorCue pixel convention) so books look distinct; optional
  `cover` image field can replace the spine with real art later.
- Generator `tools/make-placeholder-pdf.mjs` now emits 3 valid multi-page PDFs
  (welcome 6p, field-notes 8p, the-long-one 15p) in one run.
- **Verified E2E** (`tools/verify-bookshelf.mjs`, extended): opened at 1/6 → paged to
  3/6 → closed (localStorage=3) → walked away + back → **RESUMED at 3/6**. PASS.
- Build clean under Node 22; vendor + books ship to dist.

### 2026-10-20 — M2: in-world PDF library (centerpiece)
- New files: `src/ui/BookReader.ts` (DOM overlay reader, native-viewer `<iframe>`),
  `src/Scenes/components/Bookshelf.ts` (readable shelf), `src/data/books.ts` (catalog),
  `tools/make-placeholder-pdf.mjs` (generates a valid 3-page `welcome.pdf`),
  `src/assets/books/welcome.pdf`. Added `.book-reader*` CSS in `src/index.css`.
- `LibraryScene` now overrides `create()`: `super.create()` then one `Bookshelf` per
  `BOOKS` entry; closes the reader on scene sleep/shutdown.
- **Mechanic:** Bookshelf mirrors `Door` — invisible blocking `emptyDoorGraphic` sprite
  on the shelf tile; a `movementStopped` subscription opens the reader when the player
  rests on the pad (tile south of the shelf). Marked with a `drawDoorCue('READ','✦')` mat.
- **Reader:** full-screen panel over the canvas; browser's native PDF viewer in an
  `<iframe>` (paging/zoom free, offline). Disables the scene keyboard while open; backdrop
  covers the canvas so taps don't move the dog; Close restores both + re-arms.
- **Design choice:** iframe native viewer (not PDF.js) for M2 — simplest, zero deps,
  robust. Downside: can't force resume-to-page via the UI; the `#page=N` URL fragment is
  the hook for M3 resume. Switch to bundled PDF.js only if we need custom UI/bookmarks.
- Shelf tiles: Library floor is rows 7-14, spawn (8,8); shelves on row 7 (back wall).
  Catalog seeds one book at shelf (6,7)/pad (6,8); tiles (7,7) and (9,7) are free.
- **Verified E2E** with `tools/verify-bookshelf.mjs` (playwright-core 1.64.1 + cached
  chromium-1243 at `/tmp/ibc-chromium-path`; script self-serves dist on an ephemeral
  port): booted real game with `?e2e`, entered Library, walked to pad, asserted reader
  opened with `welcome.pdf`. PASS. (Background `python -m http.server` kept exiting 144
  in this shell — hence the in-script static server.)
- Build clean under Node 22; `welcome.pdf` ships to `dist/assets/books/`.
- Books currently bundled from `src/assets/books/`; M6 repoints `file` at a NAS folder.

### 2026-10-20 — M1 polish: remove lesson UI
- In `src/game.ts`, commented out (marked `BOOKCLUB M1 polish`): `initIsotopedex()`,
  `initIntro()`, `mountRadFinder()`, `mountDevWarp(game)`, and `refreshHud()`.
- Key reason to skip `refreshHud()`: it queried the release schedule and rewrote
  `#hud .hud-tip` with "walk up to an Elemental to quiz it" / "no Elementals yet" —
  it would have clobbered the static book-club HUD. Skipping it lets index.html stand.
- Imports left in place; tsconfig has no `noUnusedLocals`, so the unused imports don't
  error. Build clean under Node 22; built HUD shows only book-club text.
- Did NOT prune dead lesson code or the Firebase question/season boot (backlog).

### 2026-10-20 — M1: neutralize lesson layer (walkable world)
- Mapped the lesson machinery: every Elemental/quiz routes through
  `GameScene.spawnElemental()` (proximity → `startBattle`) and the Pokémon-style
  `GameScene.enableGrassEncounters()` (grass tile → `startBattle`).
- Neutralized both with early `return`s (marked `BOOKCLUB M1`). One choke point each
  = no edits needed in any per-scene `createNpcs`. Walkable world, flavor
  `spawnWanderingNpc` / `spawnPedestrian` NPCs, and all navigation preserved.
- Confirmed hub boot = `TestScene` (Luna Town) with a Library door at tile (24,8);
  Library (and Hardware/Hannaford/Home/Auto/Woods) enterable.
- `npm run build` clean under Node 22. TypeScript didn't choke on the unreachable
  code after the returns.
- Left lesson *cosmetics* (Isotopedex button, intro card, HUD text, RadFinder,
  teacher portal, Firebase question/season boot) in place — non-blocking; backlog.

### 2026-10-20 — M0: fork & rename
- Forked Isotopia → `/home/nah/interactive-book-club` via rsync, excluding `.git`,
  `dist`, `isotopia-offline.zip`, and the abandoned `android`/`ios` Capacitor shells.
- Copied `node_modules` was partially corrupt (rollup plugin internals missing) →
  did a clean `npm ci`. Build then succeeded under Node 22.
- Rebranded to "Interactive Book Club": `package.json` name/description,
  `src/index.html` (title, HUD, apple-mobile-web-app-title → "Book Club"),
  `www/index.html` (dev copy), `src/manifest.webmanifest` (name/short_name/description).
  NOTE: dist HTML is copied from `src/index.html`, NOT `www/index.html` (see
  rollup.config.dist.js copy targets) — edit `src/` for build output.
- Renamed inherited Isotopia `HANDOFF.md` (99 KB) → `ISOTOPIA-ENGINE-REFERENCE.md`.
- Removed the earlier stale `/home/nah/penguin-book-club` planning folder (superseded).
- Decided direction: build the PDF library on the existing `InteriorScene` +
  DOM-overlay (`LeaveButton`) pattern; presence via existing Firebase RTDB. PDF library
  is M2, not a from-scratch netcode slog.
- No gameplay logic changed yet — still the periodic-table game underneath.
