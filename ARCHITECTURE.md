# Interactive Book Club — Architecture

**Last updated:** 2026-10-20
**Status:** M0 complete (forked from Isotopia, renamed, builds clean)
**Owner:** Justin (jharvmail@gmail.com)

A private, non-commercial, friends-only walkable pixel-world that serves as an
interactive **digital library** and **book-club meeting space**. Self-hosted on the
home TrueNAS server. Built by forking Justin's own **Isotopia** game engine + art
(100% his own work — no third-party assets involved).

---

## 1. Origin & relationship to Isotopia

This project is a **fork of Isotopia** (`/home/nah/Claudia/isotopia`), Justin's
Pokémon-style periodic-table game. We copied the engine and all original art into a
fresh repo, renamed it, and will strip the lesson/battle/Elemental logic over time,
keeping the walkable world + building interiors + art as the book-club shell.

- **The live classroom game (Isotopia) is untouched.** This is a separate copy.
- Inherited engine notes live in `ISOTOPIA-ENGINE-REFERENCE.md` (the original 99 KB
  Isotopia HANDOFF — invaluable for how the engine works; it describes Isotopia, not
  this project's current plan).
- Lesson-specific planning docs (`DESERT-LESSON3-PLAN.md`, `JUNGLE-LESSON2-PLAN.md`,
  `SPRITE-BATCH-PLAYBOOK.md`, etc.) are inherited and will be pruned as we remove
  lesson content.

## 2. Stack (inherited from Isotopia)

| Layer | Tech |
|---|---|
| Engine | **Phaser 3.55** + **grid-engine** (tile movement) |
| Language | TypeScript, built with **Rollup** |
| Backend/data | **Firebase** (RTDB) — already wired; auth + persistence |
| Build | `npm run build` (needs **Node 22** — `nvm use 22`) → `dist/` |
| Dev serve | `npm run dev` / `npm run watch` (rollup-plugin-serve) |
| Deploy today | Netlify (`netlify.toml`); **target = self-host on TrueNAS** |

### Scene architecture (the key seam)
- `GameScene` → base; `InteriorScene` (abstract) → "walk around inside a building".
- A building interior is ~11 lines: subclass `InteriorScene` with a background image +
  collision map (see `LibraryScene.ts`). Entrances/exits via `Door` / `Portal` +
  `drawDoorCue`.
- **DOM overlays over the canvas already exist** (`src/ui/LeaveButton.ts`,
  `showLeaveButton`). This is the pattern the in-world **PDF reader** will reuse.
- `src/Scenes/enums/SceneNames.ts` registers all scenes; `src/game.ts` adds them.

## 3. Target experience

Walk a town hub → enter the **Library** → click a bookshelf → a PDF opens in a DOM
overlay reader → close and keep waddling. A **meeting room** shows the current club
pick ("Now Reading"); friends appear as avatars moving in real time (Firebase presence).

## 4. Milestones (mapped to the real code)

- **M0 — Fork & rename.** ✅ DONE. Copied engine+art → `/home/nah/interactive-book-club`,
  renamed to "Interactive Book Club" (package.json, `src/index.html`, manifest, HUD),
  clean `npm run build`.
- **M1 — Strip lesson logic, define the hub.** Remove Elemental/quiz/battle/season
  content; pick the hub scene (reuse `CityScene`/town) and the `LibraryScene` building.
  Game runs as a pure walkable world.
- **M2 — PDF library (centerpiece).** `Bookshelf` interactable in `LibraryScene` →
  click → **PDF.js** reader as a DOM overlay (model on `LeaveButton`). PDFs served from
  a NAS folder; range requests for paging.
- **M3 — Catalog + resume.** Book list w/ covers on shelves; remember last page per
  reader (Firebase or local).
- **M4 — Presence.** Friends' avatars visible + moving in real time via Firebase RTDB
  presence (`onDisconnect`, position writes).
- **M5 — Book-club layer.** ✅ DONE. Chat bubbles + emotes (ephemeral WS relay) and a
  shared "Now Reading" placard in the Library (persisted server-side). All E2E-verified.
- **M6 — Self-host.** ✅ BUILT & VERIFIED (deploy pending). Two-container stack (nginx
  web + `ws` presence) with same-origin `/presence` proxy; Tailscale for remote friends.
  Proxy path proven headless (`verify:proxy`); see `docs/DEPLOY-M6.md`.
- **M7 — Polish.** ✅ Avatar customization (name + colour, synced across presence) and a
  light seasonal sign in the Library. Minigames deferred (each is a feature track, not
  polish — a good post-launch direction).

## 5. Open questions — resolved for the self-host path (M6/M7)
1. ~~TrueNAS SCALE vs CORE~~ → **SCALE** (Docker). See `docs/DEPLOY-M6.md`.
2. ~~Remote access~~ → **Tailscale** (recommended), LAN fallback documented.
3. ~~Keep Firebase?~~ → **Dropped for self-host**; all live state runs on the presence
   server. (Per-member *reading progress* would still want accounts — still deferred.)
4. PDF only, or EPUB too? — still open (PDF-only today).

## 6. Handoff protocol
Persistent memory across context clears (Justin clears ~every 250k tokens). Ongoing
state lives in **`docs/HANDOFF.md`**; when Justin says "handoff", append a dated entry
and refresh its top "Current State" block. On a fresh context, read this file then
`docs/HANDOFF.md` before acting. `ISOTOPIA-ENGINE-REFERENCE.md` is the deep engine
reference.
