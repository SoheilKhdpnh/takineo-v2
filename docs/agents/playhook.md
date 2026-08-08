# Multi-Agent Engineering Playbook

## Goal

Use multiple agents to accelerate Takineo without fragmenting architecture.

## Roles

### Integration Lead

Responsibilities:

- maintain architecture coherence
- assign work
- control shared interfaces
- resolve schema conflicts
- review cross-cutting changes
- merge accepted work into `codex/integration`
- keep roadmap accurate

The integration lead should avoid implementing every task itself.

### Backend / Data Agent

Owns:

- Prisma schema
- migrations
- services
- transactions
- booking correctness
- session domain
- data integrity
- provider orchestration

### Frontend / UX Agent

Owns:

- components
- responsive UX
- student flows
- teacher flows
- admin flows
- localization
- accessibility
- loading/error states

### Security Agent

Owns review of:

- authentication
- authorization
- privilege escalation
- request security
- rate limiting
- webhooks
- secrets
- admin permissions
- abuse vectors
- logging privacy
- security headers
- RLS evaluation

Security agent should review other agents' work, not merely create independent features.

### Infrastructure / Reliability Agent

Owns:

- CI/CD
- deployment
- environment strategy
- observability
- logs
- error tracking
- background execution
- caching
- recovery
- backup/restore
- performance/scaling

### AI / Media Agent

Owns:

- Mux integration
- speaking media pipeline
- transcription
- AI analysis
- provider abstraction
- cost controls
- retries/idempotency
- structured AI outputs

### QA / Adversarial Agent

Should primarily review rather than own feature implementation.

Responsibilities:

- test critical journeys
- break authorization
- test invalid states
- test race conditions
- test duplicate webhook delivery
- test booking concurrency
- test mobile behavior
- test RTL/LTR
- test poor-network behavior
- inspect regression risk

## Task contract

Every agent task should state:

### Objective

What outcome must exist.

### Scope

Exact subsystem/files the agent owns.

### Out of scope

What must not be redesigned.

### Product rules

Relevant behavior from product specification.

### Security rules

Relevant authorization constraints.

### Dependencies

Work or interfaces required first.

### Acceptance criteria

Observable conditions for completion.

### Required checks

Usually:

`npm run check`

plus task-specific tests.

### Deliverable

A coherent commit or review-ready worktree diff.

## Parallel work rules

Good parallel work:

```text
Agent A → admin backend
Agent B → admin UI using agreed contract
Agent C → security review
Agent D → test infrastructure