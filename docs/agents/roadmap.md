# Takineo Engineering Roadmap

## Dependency principle

Parallelize independent work.

Do not parallelize several tasks that simultaneously redesign the same schema, authorization primitive, or core API contract unless coordinated by the integration lead.

---

# Wave 0 — Agent Foundation

Status: CURRENT

Deliverables:

- AGENTS.md
- product specification
- architecture specification
- engineering conventions
- security specification
- testing specification
- production-readiness specification
- agent playbook

---

# Wave 1 — Teacher Trust Completion

Primary owner:
Backend / Admin agent

Dependencies:
Existing teacher application foundation

Deliverables:

- administrative authorization model
- admin route protection
- pending teacher queue
- teacher application detail
- secure intro-video review
- approve action
- reject action
- rejection reason
- teacher resubmission behavior
- suspension foundation
- audit trail for admin review
- tests

Parallelizable:

Frontend agent:
- admin review UI

Security agent:
- admin authorization review
- privilege-escalation tests

QA agent:
- application-state tests

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