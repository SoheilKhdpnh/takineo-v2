# Takineo Architecture

## Architecture goals

Takineo should remain:

- understandable
- modular
- secure
- testable
- incrementally scalable
- operationally simple for a small team

Do not introduce distributed-system complexity before the product requires it.

## High-level architecture

```text
Browser
  |
  v
Next.js App Router
  |-- Server Components
  |-- Client Components
  `-- Route Handlers
        |
        v
  Authentication / Policy
        |
        v
  Origin / Request Security
        |
        v
  Validation
        |
        v
  Service Layer
        |-- Prisma --> PostgreSQL / Neon
        `-- External providers (Mux / future AI / future session provider)
```

## App Router boundaries

Server Components are preferred for data-backed pages that do not require
browser interactivity. Client Components own interactive state and browser APIs
but must not import server-only database, auth, secret, or provider modules.

Route Handlers are transport adapters. They authenticate, authorize, apply
request-security checks, validate untrusted input, call services, and map domain
outcomes to stable HTTP responses.

The normal mutation path is:

```text
Browser
-> Route Handler
-> authentication
-> authorization
-> origin/security validation
-> input validation
-> service
-> Prisma or external provider
```

Route Handlers must not query Prisma directly. Deliberately defined health or
repository helpers should keep database access outside the transport adapter.

## Service and domain layers

`lib/services` owns application workflows, authorization-sensitive state
transitions, transactions, and provider/database orchestration.

`lib/domain` owns pure product rules and state predicates where possible.
`lib/validations` owns Zod schemas for untrusted input. `lib/errors` owns typed
domain failures that Route Handlers map to stable machine-readable codes.

## Authentication and authorization

Better Auth establishes identity and database-backed sessions. Product roles,
teacher approval, account moderation, and administrative permission are
separate authorization concepts.

The `STUDENT`/`TEACHER` product role never substitutes for teacher approval.
Administrative access is also separate from product role selection. Wave 1 must
follow [admin-review-contract.md](admin-review-contract.md).

## Localization

Persian (`fa`) is the default locale and uses RTL layout. English (`en`) uses
LTR layout. Public UI copy belongs in both message catalogs. Domain symbols,
database identifiers, logs, and API error codes remain English.

## External providers

Provider integrations belong behind server-side modules and services. Secrets
remain server-only. Large media uploads go directly from the browser to the
provider using server-authorized temporary upload information; application
servers do not proxy video bytes.

Provider callbacks must be authenticated, idempotent or retry-safe, and matched
to internal state. Provider failures must not produce falsely successful domain
state.
