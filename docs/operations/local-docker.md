# Local Docker — Postgres + LiveKit (Wave 3 path)

Takineo’s local core stack runs **Postgres** and **LiveKit** in Docker. The Next.js app usually stays on the host to save disk; an optional `full` profile builds the app image.

## Quick start

```powershell
cd C:\Users\sohei\takineo-v2-local-core   # or your checkout of feat/local-core-integration
Copy-Item .env.docker.example .env.docker
docker compose up -d postgres livekit
npm run docker:smoke
```

Smoke must print `PASS` for Postgres and LiveKit before you continue.

## Host Next.js against Docker infra

1. Copy `.env.docker.example` → `.env.local` (or load `.env.docker`) so `PRISMA_DATABASE_ADAPTER=pg` and LiveKit vars are set.
2. Apply migrations **only** after you approve the exact command and that it targets local Docker Postgres, for example:

```powershell
# Operator-approved local-only example — do not point at Neon/production
$env:DATABASE_URL="postgresql://takineo:takineo@127.0.0.1:5432/takineo"
$env:DIRECT_URL="postgresql://takineo:takineo@127.0.0.1:5432/takineo"
npx prisma migrate deploy
```

3. `npm run dev` then book a session and open `/{locale}/sessions/{sessionId}/join`.

## Optional in-compose app

```powershell
docker compose --profile full up -d --build
```

Requires several GB of free disk. Prefer host Next when space is tight.

## Prove book → join → complete

1. Infra healthy (`npm run docker:smoke`).
2. Migrations applied to local Docker Postgres (approved command).
3. Seed or create an approved teacher + student + booked `SCHEDULED` session whose join window is open.
4. Both roles join; confirm audio and webhook ingest into `SpeakingSessionLiveEvent`.
5. After the evidence horizon, run the completion job route / operator path so status becomes `COMPLETED` from evidence (not from elapsed time alone).

SSH tunnels are **not** a working media path for two computers. Same-machine local Docker is the first proof; public 80/443 + TURN is the VPS step (`docs/operations/vps-docker.md`).

## Tear down

```powershell
docker compose down
# wipe DB volume:
docker compose down -v
```

## Evidence (local workstation)

On 2026-09-26 this workstation ran `npm run docker:smoke` against
`feat/local-core-integration` and recorded:

- `PASS postgres-ready`
- `PASS livekit-http` on `http://127.0.0.1:7880/`
- `PASS compose-ps` for `takineo-local-postgres-1` and `takineo-local-livekit-1`
- `SMOKE PASS postgres + livekit are up`

Full book → join → complete still requires an operator-approved
`prisma migrate deploy` against this local Docker Postgres (not Neon/production),
then a two-role join during an open join window. Do not migrate until that
exact command and target are approved.
