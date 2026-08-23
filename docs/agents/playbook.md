# Multi-Agent Engineering Playbook

## Goal

Use multiple agents to accelerate Takineo without fragmenting architecture,
authorization, data contracts, or migration history.

## Roles

### Integration Lead

Responsibilities:

- maintain architecture coherence
- assign work and exact file/subsystem ownership
- control shared interfaces and binding engineering contracts
- resolve schema and migration conflicts
- review cross-cutting changes
- merge accepted work into the current integration branch
- keep the roadmap accurate

The integration lead should avoid implementing every task itself.

### Backend / Data Agent

Owns:

- Prisma schema and migrations within assigned scope
- services and transactions
- domain data integrity
- provider orchestration owned by the backend task
- stable backend contracts and error mapping

### Frontend / UX Agent

Owns:

- components and responsive UX
- student, teacher, or admin flows within assigned scope
- localization and RTL/LTR behavior
- accessibility
- loading, error, and empty states

Frontend work consumes agreed server contracts and does not implement the only
authorization check for protected behavior.

### Security Agent

Owns review of:

- authentication and authorization
- privilege escalation and object substitution
- request security and rate limiting
- webhooks and provider ownership
- secrets and logging privacy
- admin permissions and account moderation
- security headers and targeted RLS evaluation

The security agent reviews other agents' work rather than independently
redesigning shared feature contracts.

### Infrastructure / Reliability Agent

Owns:

- CI/CD and environment strategy
- observability, logs, and error tracking
- background execution, caching, and scaling
- backups, restore, recovery, and deployment rollback
- controlled production migration execution

### AI / Media Agent

Owns assigned work involving:

- Mux and future speaking-media integration
- transcription and AI analysis
- provider abstraction
- cost controls, retry/idempotency, and structured AI outputs

### QA / Adversarial Agent

Primarily reviews and tests rather than owning product feature implementation.

Responsibilities:

- test critical journeys and invalid states
- attempt authorization bypass
- test race conditions and duplicate webhook delivery
- test booking concurrency when booking exists
- test mobile, RTL/LTR, and poor-network behavior
- inspect regression risk

## Task contract

Every agent task must state:

### Objective

The outcome that must exist.

### Scope

The exact subsystem and files the agent owns.

### Out of scope

What must not be redesigned or modified.

### Product rules

Relevant behavior from the product specification and binding feature contracts.

### Security rules

Relevant authentication, authorization, request-security, secret, and data
integrity constraints.

### Dependencies

Required work or interfaces that must exist first.

### Acceptance criteria

Observable conditions for completion.

### Required checks

Normally:

```bash
npm run check
```

plus task-specific tests.

### Deliverable

A coherent commit or review-ready isolated-worktree diff.

## Isolation and integration

Task agents work in isolated branches/worktrees. `main` is reserved for
intentionally integrated stable releases.

### Current integration target

```text
integration/wave2-final
```

### Integration target change, 2026-08-23

This document previously named `codex/integration` as the standing integration
target. Practice diverged from that instruction and the document was never
updated, so the recorded target became misleading.

Observed state at the time of this change:

- `codex/integration` pointed at `a5f0b61`, an intermediate Wave 1 commit.
- It did not contain the Wave 1 closure commit `28eef17`.
- It contained **zero** commits absent from `integration/wave2-final`, and was a
  direct ancestor of it, so it held no unique work.
- All Wave 1 closure and all Wave 2 work had been integrated on
  `integration/wave2-final` (`12ebf3a`) instead.

Resolution:

- `integration/wave2-final` is the real integration target as of 2026-08-23.
- `codex/integration` is fully absorbed and retains no unique work. It is
  **flagged for deletion** rather than left labeled as live. Deletion is an
  integration-lead decision and has not been performed.
- `docs/engineering/admin-review-contract.md` still refers to integration into
  `codex/integration`. That reference is retained as a Wave 1 historical record
  of intent and is not a current instruction.

Going forward, the integration target is per-wave rather than a single permanent
branch. When a wave opens, the integration lead records its integration branch
in this section rather than assuming a global default.

### Configuration sweep, 2026-08-23

Every tracked location that can carry a base branch was checked for a stale
`codex/integration` reference.

| Location | Base branch | Stale reference |
|---|---|---|
| `.github/workflows/ci.yml` | `main` only, on `push` and `pull_request` | none |
| `.github/dependabot.yml` | no `target-branch`, so it inherits the repository default | none |
| `netlify.toml` | no branch-specific contexts | none |
| `origin/HEAD` | `origin/main` | none |

No tracked configuration was left pointing at the stale branch.

The remaining `codex/integration` mention in
`docs/engineering/admin-review-contract.md` is a Wave 1 historical record of
intent, not a current instruction, and is deliberately retained.

### Known drift outside tracked configuration

Two items are outside version control and cannot be fixed by editing this
repository. They are recorded so an integration lead can act on them.

**Local Git configuration.** Developer clones may retain
`branch.*.vscode-merge-base` entries pointing at `origin/codex/integration`,
including for `feat/wave2-booking-foundation`. An editor configured that way
computes its diff against the stale branch and will present a misleading view of
what a branch changed. Agents must not edit Git configuration; report it instead.

**Remote branch.** `origin/codex/integration` still exists at `a5f0b61`.
Retiring the branch requires deleting the remote ref as well as the local one,
which is an integration-lead decision.

### CI coverage caveat

CI triggers only against `main`, so neither Wave 1 nor Wave 2 work was CI-gated
on its own branch; quality gates were run locally by each track. An integration
lead should decide whether CI should also trigger on the active integration
branch before the next wave integrates.

### Deployment caveat

`netlify.toml` defines:

```toml
[context.production]
  command = "npm run db:migrate:deploy && npm run build"
```

The production context therefore applies migrations automatically, and the branch
Netlify treats as production is a provider dashboard setting rather than a value
in this repository. Whichever branch is wired to the production context is an
effective migration-deployment target, so it must be confirmed in the provider
before any wave merges a schema change.

Agents must not force-push shared branches, rewrite unrelated history, or edit
unrelated files. Shared schema, migrations, package configuration, localization
catalogs, and core auth/policy files require explicit ownership coordination.

## Parallel work rules

Good parallel work has agreed contracts and separated ownership:

```text
Agent A -> admin backend and shared API contract
Agent B -> admin UI against the agreed contract
Agent C -> security review of integrated behavior
Agent D -> isolated testing foundation and adversarial coverage
```

Do not parallelize agents that independently redesign the same schema,
authorization primitive, state machine, migration chain, or API response shape.

Before dependent frontend work begins, the integration lead should publish the
backend contract or approve a shared interface. Before multiple database tasks
begin, migration ordering and schema ownership must be explicit.

## Shared-file conflict surfaces

Treat these areas as single-owner or contract-first during a wave:

- `prisma/schema.prisma` and `prisma/migrations`
- `lib/auth`, shared access policy, and server environment validation
- shared domain state types and transition helpers
- `messages/fa.json` and `messages/en.json`
- `package.json`, lockfiles, test configuration, and CI configuration
- route contracts consumed by multiple agents

Agents should communicate required shared-file changes to the integration lead
instead of making overlapping speculative edits.

## Wave 1 binding contract

All Wave 1 admin/review work must follow
[admin-review-contract.md](../engineering/admin-review-contract.md).

In particular:

- administrative access remains separate from `STUDENT`/`TEACHER`
- account moderation is server-controlled
- profile and video decisions are separate
- application approval requires an approved current video
- review and permission history is immutable/auditable
- pending video playback is signed/private
- public playback has a separate lifecycle
- database tests fail closed without `TEST_DATABASE_URL`

Material contract changes must be resolved by the integration lead and updated
in documentation before agents implement divergent assumptions.

## Review and handoff

Before handoff, an agent should provide:

- concise behavior summary
- files changed
- migrations and reviewed SQL, if applicable
- checks/tests run and exact results
- known limitations or follow-up work
- contract or security decisions that need integration-lead review

The integration lead validates cross-cutting behavior and conflict surfaces
before accepting work into the integration branch.
