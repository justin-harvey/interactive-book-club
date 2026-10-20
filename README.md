# Interactive Book Club

A private, friends-only, non-commercial walkable pixel-world that doubles as an
interactive **digital library** and **book-club meeting space**. Self-hosted on a home
TrueNAS server.

Forked from Justin's own **Isotopia** game — same engine (Phaser 3 + grid-engine) and
all his original art. This copy is being reshaped from a periodic-table learning game
into a cozy library/clubhouse. The live Isotopia classroom game is untouched.

## Run it
```bash
nvm use 22
npm install       # first time
npm run build     # -> dist/
npm run dev       # local dev server
```

## Docs
- **`ARCHITECTURE.md`** — stack, scene architecture, milestone plan (M0–M7).
- **`docs/HANDOFF.md`** — living state / persistent memory across context clears.
- **`docs/DEPLOY-M6.md`** — self-host on TrueNAS (Docker + Tailscale).
- **`ISOTOPIA-ENGINE-REFERENCE.md`** — deep engine reference inherited from Isotopia.

## Status
Feature-complete through **M7**: walkable world, in-world PDF library (catalog + resume),
real-time presence, a social layer (chat bubbles, emotes, shared "Now Reading"), avatar
customization (name + colour), and a self-host container stack. All verified by headless
E2E (`npm run verify:*`). Remaining: run the deploy on the NAS (see `docs/DEPLOY-M6.md`).
See `docs/HANDOFF.md` → Current State.
