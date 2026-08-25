# Takineo Engineering Roadmap

## Dependency principle

Parallelize independent work.

Do not parallelize several tasks that simultaneously redesign the same schema, authorization primitive, or core API contract unless coordinated by the integration lead.

## Wave numbering reconciliation

Teacher discovery, originally planned as Wave 3 below, was delivered inside
Wave 2 as Track B. That collapsed the delivery numbering by one relative to the
headings in this file.

Live speaking work is therefore named **Wave 3** in branches, contracts, and
tests, even though it appears under the "Wave 4 — Speaking Session MVP" heading
below. This is already binding upstream in
`docs/engineering/wave2-domain-contract.md` §8 and §17.

The historical wave headings below are deliberately not renumbered, so existing
contracts, closure records, and commit history keep resolving. Use the status
lines to determine actual state.

---

# Wave 0 — Agent Foundation

Status: COMPLETE / DOCUMENTATION REVIEW PENDING

Deliverables:

- AGENTS.md
- product specification
- architecture specification
- engineering conventions
- security specification
- testing specification
- production-readiness specification
- agent playbook
- binding Wave 1 admin/review contract

Canonical Wave 1 contract:

`docs/engineering/admin-review-contract.md`

---

# Wave 1 — Teacher Trust Completion

Status: COMPLETE AFTER M18 CLOSURE / PUBLIC-BETA GATE REMAINS SEPARATE

All Wave 1 agents must follow:

`docs/engineering/admin-review-contract.md`

No agent may independently change the admin identity boundary, permission
matrix, account-state semantics, teacher review transitions, Mux playback
lifecycle, audit requirements, or test-database safety rules without
integration-lead approval and a contract update.

Primary owner:
Backend / Admin agent

Dependencies:
Existing teacher application foundation

Deliverables:

- separate server-controlled administrative authorization linked to an existing
  user; do not add `ADMIN` to product-role onboarding
- `REVIEWER` and `SUPER_ADMIN` permission enforcement
- privileged initial-admin bootstrap boundary
- server-controlled `ACTIVE`, `SUSPENDED`, and `DISABLED` account states
- admin route protection
- pending teacher queue
- teacher application detail
- signed/private Mux intro-video review and short-lived server-issued playback
  tokens
- transactionally safe profile/video/final approval actions
- `PROFILE`, `VIDEO`, and `BOTH` rejection targets
- target-specific rejection reasons
- teacher resubmission behavior
- suspension foundation
- immutable audit trail for admin review and administrative access changes
- separate approved public-playback lifecycle and revocation behavior
- tests

Parallelizable:

Frontend agent:
- admin review UI

Security agent:
- admin authorization review
- privilege-escalation tests
- Mux signed/public playback review
- account-state bypass review

QA agent:
- application-state tests
- Vitest, React Testing Library, and Playwright foundation
- fail-closed database-test configuration using only `TEST_DATABASE_URL`
- authorization matrix from the Wave 1 contract

Integration order:

1. Integration lead approves backend API shapes, shared state transitions,
   schema ownership, and migration order.
2. Backend/data work establishes the agreed contract implementation.
3. Frontend consumes agreed API shapes without inventing authorization rules.
4. Security and QA review the integrated behavior adversarially.

---

# Wave 2 — Availability and Booking Core

Status: DELIVERED AND INTEGRATED ON `integration/wave2-final` / TRACK A IS
STABLE-FOR-HANDOFF RATHER THAN FORMALLY CLOSED

Canonical contract:

`docs/engineering/wave2-domain-contract.md`

Delivery notes:

- Track A booking core: `M1 status: CLOSED` in the contract. M3 batch
  next-available projection was implemented as
  `getNextBookableAvailabilityForTeachers` and independently verified by Track D,
  but the contract's own M2/M3 status lines were never recorded, and §16 still
  assigns booking schema ownership to Track A "while Track A is active".
  Treat booking schema, `SpeakingSession` columns, and the booking state machine
  as Track A-owned until an integration lead formally closes Track A.
- Track B public teacher discovery: delivered. This absorbed the original
  Wave 3 scope below.
- Track C product UI: delivered.
- Track D verification: delivered, recorded under
  `docs/engineering/track-d-wave2-*.md`.

Primary owner:
Booking / Backend agent

Deliverables:

- availability domain model
- recurring/one-off availability strategy
- teacher timezone handling
- student timezone display
- availability API
- booking model
- transactional booking
- double-booking prevention
- cancellation lifecycle
- booking tests

Hard dependency:

Only APPROVED teachers may publish availability.

Parallelizable:

Frontend:
- teacher availability UI
- student booking UI shells

Security:
- authorization matrix
- booking abuse review

QA:
- concurrency testing

---

# Wave 3 — Teacher Discovery

Status: DELIVERED INSIDE WAVE 2 AS TRACK B

This heading is retained for historical continuity. The scope below shipped with
Wave 2 rather than as a separate wave, which is the source of the numbering
reconciliation noted at the top of this file.

Evidence:

- `app/api/teachers/route.ts`
- `app/api/teachers/[teacherProfileId]/route.ts`
- `app/api/teachers/[teacherProfileId]/slots/route.ts`
- `lib/services/teacher-discovery.service.ts`
- `lib/services/public-teacher-discovery-eligibility.service.ts`
- `components/teachers/TeacherDiscoveryPanel.tsx`
- `prisma/migrations/20260818222000_add_public_teacher_discovery_eligibility`
- `tests/unit/booking/public-teacher-privacy-contract.test.ts`

Deliverables:

- public approved-teacher query
- teacher listing
- teacher profile
- approved intro-video playback
- basic filters
- availability preview
- localized UI
- loading/error states
- pagination/caching strategy

Public teacher query must require approval conditions.

---

# Wave 4 — Speaking Session MVP

Status: IN PROGRESS AS "WAVE 3 — LIVE SPEAKING" ON `feat/wave3-live-speaking`

Canonical contract:

`docs/engineering/wave3-live-session-contract.md`

Milestone state:

- M1-A join authorization and provider identity boundary: CLOSED
  (`lib/domain/live-session/policy.ts`, `lib/domain/live-session/provider.ts`)
- M1-B evidence reduction and independent timing policies: CLOSED
  (`lib/domain/live-session/evidence.ts`). Production values for `REJOIN_GRACE`
  and `EVIDENCE_HORIZON_GRACE` remain deliberately unfrozen.
- M2 additive persistence (`SpeakingSessionLiveGrant`,
  `SpeakingSessionLiveEvent`): CLOSED
- M3 services and transport: CLOSED against a fake provider adapter
  (`lib/services/live-session-*.ts`, join/evidence/webhook/completion-job
  routes). Vendor selection remains open.
- M4 localized join surface: NOT STARTED

This wave owns the durable transition to `COMPLETED`, per
`docs/engineering/wave2-domain-contract.md` §8. It must not redefine Wave 2
booking columns or statuses.

Deliverables:

- session lifecycle model
- session provider abstraction
- provider selection
- join authorization
- exactly 15-minute session constraints
- teacher/student room access
- session state
- recording/transcription strategy
- disconnect/reconnect behavior
- session completion

Security review required before integration.

---

# Wave 5 — AI Learning Pipeline

Status: NOT STARTED

Deliverables:

- transcript ingestion
- AI analysis job architecture
- grammar analysis
- vocabulary analysis
- fluency analysis
- pronunciation analysis
- structured AI result schema
- teacher review interface
- teacher edits/comments
- publish feedback
- student report
- homework generation
- vocabulary history
- grammar history
- progress tracking

AI results must remain distinguishable from teacher-reviewed results.

---

# Wave 6 — Product Communication

Status: NOT STARTED

Deliverables as needed:

- transactional email
- session reminders
- booking confirmations
- cancellations
- application-review notifications
- report-ready notifications

Provider selection should be isolated behind a notification service.

---

# Wave 7 — Production Hardening

Status: PARTIALLY DELIVERED AHEAD OF SEQUENCE

Already in place from earlier waves:

- CI quality gates (`.github/workflows/ci.yml`)
- security headers helper (`lib/security/browser-security-headers.ts`)
- admin audit trail with database-level immutability triggers
- health/readiness probe (`app/api/health/database/route.ts`)
- database index review for booking and session reads
- production dependency audit (`npm run security:audit:prod`)
- backup/restore and rollback records under `docs/operations/`

Still missing:

- rate limiting, which `docs/engineering/security.md` requires before public beta
- structured logging and error tracking
- cache policy and CDN review
- performance testing beyond the Track D discovery complexity probes

Parallel infrastructure/security track.

Deliverables:

- rate limiting
- security headers
- admin audit completion
- structured logging
- error tracking
- health/readiness
- cache policy
- CDN review
- database index review
- performance testing
- CI/CD hardening
- production environment configuration
- backup verification
- restore test
- deployment rollback
- incident runbook
- dependency/security audit

---

# Wave 8 — Closed Beta

Status: NOT STARTED

Deliverables:

- production deployment
- staging/preview verification
- seeded test users
- end-to-end smoke tests
- real teacher application test
- real booking test
- real speaking-session test
- real AI report test
- monitoring verification
- controlled user onboarding

---

# Wave 9 — Public Beta

Only after the release gate in:

`docs/operations/production-readiness.md`

is satisfied.
