# Iran WebRTC reachability diagnostic

Standalone operator tool for Wave 3 live-speaking **vendor reachability**.
It is not product UI, not M4 join, and not part of the Next.js / Netlify app.

Copy this directory onto the candidate host (or run it on a laptop) and open it
from a **browser that is on the Iranian network under test**. WebRTC and the
signalling WebSocket then leave that browser toward the candidate LiveKit/TURN
host. Serving the same files through Netlify would confound “can we fetch the
Takineo site?” with “can media reach the SFU/TURN?”.

Speaking sessions are 15 minutes. The long hold is that duration and **never
starts on page load**.

## What it measures

1. Signalling WebSocket time-to-connect (and later close code).
2. ICE candidate types with `iceTransportPolicy: "all"` (host / srflx / relay).
3. The same gather with `iceTransportPolicy: "relay"`.
4. Time-to-first-audio over a **TURN loopback** (two `RTCPeerConnection`s in
   this browser, test tone through TURN — no second human participant).
5. An explicit **15-minute hold** that logs `getStats()` RTT, jitter, packet
   loss, the selected candidate pair, and every `Reconnecting` / `Reconnected`
   event (ICE, peer connection, and signalling socket).

## Per-transport isolation

Select **one** path. ICE servers are limited to that TURN URL so ICE cannot
silently pick another port or protocol:

| UI label     | Default URL |
| ------------ | ----------- |
| UDP/3478     | `turn:{host}:3478?transport=udp` |
| UDP/443      | `turn:{host}:443?transport=udp` |
| UDP/53       | `turn:{host}:53?transport=udp` |
| TCP/443 TLS  | `turns:{host}:443?transport=tcp` |
| TCP/80       | `turn:{host}:80?transport=tcp` |

Media probes default to `iceTransportPolicy: "relay"`. Using `all` is allowed
for comparison but is **not** a per-transport proof.

## How to serve (not through the Next app)

From this directory:

```bash
node server.mjs
```

Then open `http://127.0.0.1:4173/` (or the candidate host’s address). Override
with `HOST` and `PORT`.

Alternatives:

```bash
npx --yes serve -p 4173
```

nginx `alias` / `root` pointing at this folder is also fine. Do not add this
path to `netlify.toml` or the App Router.

The page uses ES modules and `fetch('./config.json')`, so it must be served
over HTTP(S). `file://` will not load config.

Use HTTPS or `localhost` if the browser blocks WebRTC / WebSocket mixed content.

## Configuration

Load order (later wins):

1. Built-in defaults
2. `config.json` (placeholders only in git)
3. `config.local.json` (gitignored — preferred for credentials)
4. Query parameters

Query example:

```text
http://127.0.0.1:4173/?signallingUrl=wss://livekit.example.invalid&turnHost=turn.example.invalid&turnUsername=demo&transport=tcp-443-tls&iceTransportPolicy=relay
```

Supported query keys: `signallingUrl`, `turnHost`, `turnUsername`,
`turnCredential`, `stunUrls` (comma-separated), `iceTransportPolicy`,
`transport`, `holdMs`, `statsIntervalMs`, `signallingKeepalive` (`1` / `0`).

`transportUrls` in JSON may replace the default URL templates. Use `{host}` as
the TURN hostname placeholder.

Do **not** commit production Mux, Neon, LiveKit, or TURN secrets. Prefer
ephemeral TURN REST credentials. `Download log JSON` redacts `turnCredential`.

Signalling keepalive pings stay **off** by default so idle disconnects on a
candidate host are visible. Enable them only if that host requires application
pings.

A raw WebSocket to LiveKit without the vendor protocol will often open, then
close. Time-to-connect is still the TLS/WebSocket reachability signal.

TURN loopback requires the candidate TURN server to allow **hairpinning**
(relaying packets back to the same client). If relay candidates appear but
first-audio fails, check that policy on the host; it is a host finding, not a
reason to put this page on Netlify.

## How this maps to the product

Takineo speaking sessions are exactly 15 minutes. This diagnostic holds media
for that duration so Iran-path RTT, jitter, loss, and reconnects are observed
for a full session — not a 30-second happy path.

It does **not** freeze LiveKit (or any vendor), issue join grants, or implement
M4. See `docs/engineering/wave3-live-session-contract.md` §13.
