# Takineo Agent Instructions

Takineo is a production-oriented, Persian-first English-learning SaaS.

Human teachers teach.
AI analyzes and assists.
AI does not replace teachers.

This file is the repository map and set of non-negotiable engineering rules.
Detailed specifications live under `/docs`.

## Read before modifying code

Read the relevant documents before implementing a task:

- Product behavior:
  `docs/product/product-spec.md`

- System architecture:
  `docs/engineering/architecture.md`

- Coding conventions:
  `docs/engineering/conventions.md`

- Security and authorization:
  `docs/engineering/security.md`

- Testing requirements:
  `docs/engineering/testing.md`

- Production requirements:
  `docs/operations/production-readiness.md`

- Remaining roadmap and dependencies:
  `docs/agents/roadmap.md`

- Multi-agent collaboration:
  `docs/agents/playbook.md`

## Current stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- next-intl
- Better Auth
- Prisma ORM 7
- PostgreSQL / Neon
- Mux for teacher introduction video
- GitHub

## Localization

Takineo launches Persian-first.

- Persian locale: `fa`
- English locale: `en`
- Persian is the default locale.
- Persian layouts are RTL.
- English layouts are LTR.
- Never hardcode user-facing UI copy in components when it belongs in localization files.
- Add user-facing copy to both:
  - `messages/fa.json`
  - `messages/en.json`

Internal identifiers, APIs, database fields, code symbols, and logs remain English.

## Architecture boundaries

The normal write path is:

Browser
→ Route Handler
→ authentication
→ authorization
→ origin/security validation
→ input validation
→ service layer
→ Prisma
→ PostgreSQL

Do not use Prisma directly from:

- React components
- client components
- Route Handlers

Database access belongs in server-side services or deliberately defined repository helpers.

React components must not contain business authorization logic that exists only in the UI.

## Authorization

Frontend visibility is not authorization.

Every protected operation must be enforced server-side.

A user selecting the teacher role is a teacher applicant, not an approved teacher.

Teacher application states:

- DRAFT
- PENDING_REVIEW
- APPROVED
- REJECTED
- SUSPENDED

A teacher must not create availability, appear publicly, or receive bookings merely because:

`role === "TEACHER"`

Public teacher eligibility requires at minimum:

- applicationStatus = APPROVED
- profileCompletedAt is not null
- approved introduction video
- active account

Application-specific rules live in:

`docs/engineering/security.md`

## Teacher introduction video

Requirements:

- 60–120 seconds
- direct upload to Mux
- application server must not proxy video bytes
- pending/rejected/failed videos are not public
- public playback is created only when appropriate for approved teachers
- webhook processing must be idempotent
- a provider-sync fallback exists for missed webhook events

Never expose Mux API secrets to client code.

## Database rules

Prisma schema:

`prisma/schema.prisma`

Generated client:

`lib/generated/prisma`

Never manually edit generated Prisma files.

Every schema change requires:

1. Edit Prisma schema.
2. Create a migration.
3. Review generated SQL.
4. Preserve existing data deliberately.
5. Apply only to the intended environment.
6. Regenerate Prisma Client.
7. Run validation and tests.

Never run destructive database commands against production.

Do not use `prisma db push` as the normal production schema deployment strategy.

## Environment and secrets

Never commit:

- `.env`
- `.env.local`
- API secrets
- database passwords
- Better Auth secrets
- Mux secrets
- private keys

Client-visible environment variables must be intentionally prefixed with `NEXT_PUBLIC_`.

Secrets must remain server-only unless explicitly designed otherwise.

## Error handling

Expected domain failures should use typed/domain-specific errors.

Do not rely on parsing error-message strings.

API routes should map domain errors to stable machine-readable error codes.

Unexpected errors may be logged server-side but should not leak internal details to clients.

## Validation

All untrusted input must be validated at the server boundary.

Use Zod for request/domain validation unless a documented decision specifies otherwise.

Client-side validation is UX, not security.

## Time and dates

Persist canonical timestamps in the database.

Default product timezone is currently:

`Asia/Tehran`

Do not embed localized date formatting into domain or persistence logic.

## Git and agent workflow

Task agents must work in isolated branches/worktrees.

Do not force-push shared branches.

Do not rewrite unrelated history.

Do not modify unrelated files merely to clean them up.

Prefer small, coherent commits.

The integration target for agent work is:

`codex/integration`

`main` is reserved for intentionally integrated stable releases.

## Definition of done

A feature is not complete merely because it renders.

Before declaring a task complete:

- business rules are enforced server-side
- localization is complete where applicable
- permissions are tested
- error states are handled
- loading states are handled
- relevant tests are added or updated
- migration safety is reviewed where applicable
- no secrets are committed
- lint passes
- typecheck passes
- build passes
- `npm run check` passes

Run:

`npm run check`

before completing any code-changing task unless the task explicitly documents why it cannot run.

## Agent behavior

Before coding:

1. Read the relevant documentation.
2. Inspect existing implementations and conventions.
3. Identify dependencies and authorization boundaries.
4. Avoid duplicating existing helpers.
5. Make the smallest coherent change that fully satisfies the task.

Do not invent product behavior when the specification is ambiguous and the decision would materially affect users, security, money, permissions, or data integrity.

In those cases, surface the decision to the integration lead.