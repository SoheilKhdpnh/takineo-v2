# Engineering Conventions

## TypeScript

Use TypeScript for application code.

Avoid `any` unless integration with an unavoidable external API requires it and the reason is documented.

Prefer explicit domain types.

## Imports

Use the configured `@/` project alias for project-level imports.

Avoid deep relative imports when an alias is clearer.

## Components

Server Components are preferred when client interactivity is not required.

Use `"use client"` only where browser state, effects, browser APIs, or interactive event handling are necessary.

Client Components must not import server-only modules.

## Route Handlers

Route handlers should remain thin.

Preferred structure:

```text
request
→ auth
→ authorization
→ origin/security
→ validation
→ service
→ HTTP mapping