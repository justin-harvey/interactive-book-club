# M6 — Self-host on TrueNAS (Docker + Tailscale)

Goal: run the Interactive Book Club on the home **TrueNAS** box so friends can actually
join, with no cloud. The stack is two containers behind one port:

| Service    | Image             | Role                                                        |
|------------|-------------------|-------------------------------------------------------------|
| `web`      | `Dockerfile`      | nginx serving the built game **and** proxying `/presence`   |
| `presence` | `Dockerfile.presence` | the WebSocket relay (`server/presence-server.mjs`)      |

Only `web`'s port **8080** is published. `presence` is reachable only by `web` over the
internal compose network, as the host `presence`. The game connects to the WebSocket at
the **same origin** (`ws(s)://<host>/presence`) — nginx upgrades and forwards it — so there
is no cross-origin or extra-port config for clients. (This exact wiring is proven headless,
without Docker, by `npm run verify:proxy`.)

The club's **"Now Reading"** pick persists to `NOW_READING_FILE` (default
`/data/now-reading.json`), which is a mounted volume — it survives rebuilds/restarts.

---

## 0. Quick local smoke test (any Docker host)

```bash
docker compose up -d --build        # or: npm run docker:up
# open http://localhost:8080 in two tabs, enter the Library -> two avatars, chat, react,
# set "Now Reading" -> both see it.
docker compose down                 # npm run docker:down
```

---

## 1. TrueNAS: use SCALE, not CORE

Use **TrueNAS SCALE** (Linux/Docker). CORE (FreeBSD jails) has no native Docker/Compose.
*(Resolves ARCHITECTURE §5 Q1 — the stack assumes SCALE.)*

Two routes depending on your SCALE version:

### Route A — native Docker Compose (SCALE 24.10 "Electric Eel" or newer)
SCALE ships Docker and supports compose directly.
1. Clone the repo onto a dataset, e.g. `/mnt/tank/apps/interactive-book-club`.
2. Create the persistence dir: `mkdir -p /mnt/tank/apps/interactive-book-club/data`.
3. From that directory: `docker compose up -d --build`.
4. (Optional) manage it with the **Dockge** or **Portainer** community app pointed at the
   same compose file for a UI + auto-restart.

### Route B — prebuilt images (older SCALE, image-only custom apps)
If your SCALE can't build from source, build + push images from a workstation:
```bash
docker build -t ghcr.io/<you>/ibc-web:latest -f Dockerfile .
docker build -t ghcr.io/<you>/ibc-presence:latest -f Dockerfile.presence .
docker push ghcr.io/<you>/ibc-web:latest
docker push ghcr.io/<you>/ibc-presence:latest
```
Then in compose, replace each `build:` block with `image: ghcr.io/<you>/ibc-*:latest` and
deploy via Dockge/Portainer or the compose CLI.

### Persistence on TrueNAS
Point the `presence` volume at a dataset path instead of `./data`:
```yaml
  presence:
    volumes:
      - /mnt/tank/apps/interactive-book-club/data:/data
```
`NOW_READING_FILE=/data/now-reading.json` is already set in the image.

---

## 2. Remote access

### Tailscale (recommended) — *resolves ARCHITECTURE §5 Q2*
Friends join your **tailnet**; no ports exposed to the internet, HTTPS for free (so the
client uses `wss://…/presence`, which nginx proxies fine).

1. Install Tailscale on the NAS (SCALE has a Tailscale app, or run `tailscaled` on host).
2. Expose the published port over the tailnet with MagicDNS + TLS:
   ```bash
   tailscale serve --bg --https=443 http://127.0.0.1:8080
   ```
   The game is now at `https://<nas-name>.<tailnet>.ts.net`.
3. Invite friends to the tailnet (Tailscale admin → share node / add users). They open that
   URL and walk in. WebSocket presence rides the same HTTPS origin automatically.

### LAN-only fallback
No Tailscale? On the same network, friends use `http://<nas-lan-ip>:8080`. Presence resolves
to `ws://<nas-lan-ip>:8080/presence` through nginx. (Do **not** port-forward 8080 to the open
internet — this app has no auth; it's friends-only by network.)

---

## 3. Firebase is off (and that's fine) — *resolves ARCHITECTURE §5 Q3 for now*

Nothing here needs Firebase. With `FIREBASE_*` build config unset, the boot's Firebase init
falls back harmlessly and **all** multiplayer/social state runs on the self-hosted presence
server (ephemeral chat/emotes relayed; the club pick persisted to the volume). The one thing
that would still want real accounts — **per-member reading progress** — remains per-device
`localStorage` and is deferred.

---

## 4. Updating

```bash
cd /mnt/tank/apps/interactive-book-club
git pull
docker compose up -d --build        # rebuilds changed layers, keeps the data volume
```

The `data/` volume (and thus the current "Now Reading" pick) is untouched by rebuilds.

---

## 5. Notes / future

- **Books** are bundled from `src/assets/books/` today. To serve a growing library from a
  NAS folder without rebuilding, mount that folder into the `web` container under the nginx
  root and point each `book.file` (in `src/data/books.ts`) at its served path.
- **Scale/timeouts:** nginx keeps presence sockets open 1h idle (`proxy_read_timeout`); the
  client auto-reconnects with backoff, so brief restarts are invisible to players.
- **Netlify** (the old `netlify.toml`) still works for a *static* preview, but it serves the
  game only — no presence/social backend. Self-host is required for the multiplayer features.
