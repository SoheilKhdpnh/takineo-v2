# International VPS Docker — after local proof

Deploy only after `docs/operations/local-docker.md` smoke and a same-machine LiveKit join succeed.

## Preconditions

- Local `docker compose up -d postgres livekit` is healthy.
- Branch `feat/local-core-integration` (or the integrated release branch) is pushed.
- You have SSH access to the international VPS.
- DNS / firewall plan for app HTTPS and LiveKit (7880/7881 + UDP media, preferably TURN on 443).

## Deploy outline

1. Clone the repo on the VPS; check out the integrated branch.
2. Copy `.env.docker.example` → `.env.docker` and replace **every** secret (Better Auth, LiveKit keys, DB password). Set public `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL`.
3. Edit `docker/livekit.vps.yaml`: production API key/secret, webhook `https://YOUR_HOST/api/webhooks/live-session`, and `node_ip` / `use_external_ip` for the VPS.
4. Start:

```bash
docker compose -f docker-compose.yml -f docker-compose.vps.yml up -d postgres livekit
```

5. **Migrations:** do **not** run until the operator approves the exact command and target (this VPS Postgres only). Example shape only:

```bash
# APPROVAL REQUIRED — replace with the agreed command/target
docker compose exec -T postgres pg_isready -U takineo
# then an approved: prisma migrate deploy with DIRECT_URL to this VPS DB
```

6. Put TLS termination (Caddy/nginx) in front of the app and LiveKit signalling. Prefer TURN reachable from Iranian client networks; validate with `diagnostics/iran-webrtc/` before closed beta.

7. App: either host Node, or `docker compose -f docker-compose.yml -f docker-compose.vps.yml --profile full up -d --build`.

## Still open (not closed by this file)

- Production grace values for rejoin / evidence horizon
- Iran-path TURN proof
- Wave 4 AI engines on an analysis host (separate from this LiveKit VPS if desired)

## Rollback

```bash
docker compose -f docker-compose.yml -f docker-compose.vps.yml down
# volumes retained unless you pass -v
```
