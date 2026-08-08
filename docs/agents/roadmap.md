# Takineo Engineering Roadmap

## Dependency principle

Parallelize independent work.

Do not parallelize several tasks that simultaneously redesign the same schema, authorization primitive, or core API contract unless coordinated by the integration lead.

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
