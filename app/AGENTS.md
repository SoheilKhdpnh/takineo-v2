# App-layer instructions

These instructions apply beneath `/app`.

Route Handlers are transport adapters, not business-service implementations.

For write APIs:

request
→ authentication
→ authorization
→ origin/security check
→ validation
→ service
→ response mapping

Do not query Prisma directly from Route Handlers.

Do not place secrets in React code.

User-facing pages must support both Persian and English.

Use locale-aware navigation helpers from the existing i18n layer.

Server-side authorization is required even when the UI hides an action.

Prefer Server Components unless browser interactivity is required.