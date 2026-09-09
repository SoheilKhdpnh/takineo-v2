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
- merge accepted work into `codex/integration`
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

Task agents work in isolated branches/worktrees. The integration target is
`codex/integration`; `main` is reserved for intentionally integrated stable
releases.

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
