# Production Readiness

This document is the release gate for Takineo. A feature-complete application
is not automatically production-ready.

## 1. Frontend foundation

Status: FOUNDATION EXISTS

Required before public beta:

- responsive student, teacher, and admin UI
- Persian and English localization
- RTL/LTR verification
- accessibility review
- loading, error, and empty states
- browser compatibility pass

## 2. Backend

Status: FOUNDATION EXISTS

Current architecture:

```text
Route Handler
-> authentication / authorization / request security
-> validation
-> service
-> Prisma or external provider
```

Required:

- stable domain errors and HTTP mappings
- transactionally safe admin review and booking workflows
- idempotent/retry-safe webhooks and provider cleanup
- asynchronous work boundaries
- controlled external-provider failures

## 3. Database and migrations

Status: FOUNDATION EXISTS

Current:

- PostgreSQL / Neon
- Prisma
- versioned migrations

Required:

- production migration workflow separated from generic application builds
- controlled migration gate
- migration/schema validation before release
- explicit target-environment verification
- exactly one migration execution path per release
- reviewed migration SQL and data-preservation plan
- rollback/recovery procedure
- applied-migration visibility
- index and query-performance review
- booking constraints when booking is introduced
- backup policy and restore exercise

The current hosting pattern that combines:

```text
prisma migrate deploy && npm run build
```

is not the final production migration strategy. A release must not allow
multiple competing migration execution paths.

## 4. Storage and media

Status: PARTIAL

Current:

- direct-to-Mux teacher video foundation
- signed Mux webhook handling
- provider-sync fallback

Required:

- production Mux environment isolation
- secure production webhooks
- signed/private admin review playback
- separate approved public playback lifecycle
- playback revocation and retry-safe provider cleanup
- provider failure observability
- retention rules
- future speaking-recording/storage decision

Pending/rejected videos must never become publicly playable.

## 5. Authentication, account state, and permissions

Status: PARTIAL / STRONG FOUNDATION

Current:

- Better Auth
- protected database sessions
- student/teacher onboarding
- teacher application states

Required:

- separate server-controlled administrative access
- `REVIEWER` and `SUPER_ADMIN` enforcement
- privileged initial-admin bootstrap
- auditable admin access changes
- server-controlled `ACTIVE`, `SUSPENDED`, and `DISABLED` account states
- email/account verification policy
- full authorization test matrix
- session/security review

Wave 1 must follow
[admin-review-contract.md](../engineering/admin-review-contract.md).

## 6. Hosting

Status: NOT FINALIZED

Required:

- production Next.js host decision
- canonical production domain
- production/staging/preview isolation
- TLS
- deployment rollback procedure
- migration execution ownership

## 7. Cloud and computing

Status: PARTIAL / MANAGED-SERVICE STRATEGY

Prefer managed infrastructure. Required decisions include:

- Next.js compute/runtime
- asynchronous job execution
- session/video/AI workload boundaries
- scheduled/background processing

## 8. Testing and CI/CD

Status: TEST TOOLING NOT YET IMPLEMENTED / BASIC BUILD FOUNDATION

Wave 1 tooling contract:

- Vitest
- React Testing Library
- Playwright
- database integration tests using only `TEST_DATABASE_URL`
- fail-closed behavior when a safe test database is absent

`DATABASE_URL` and `DIRECT_URL` must never be test fallbacks.

Required CI/CD gates:

- dependency installation from lockfile
- Prisma generation and validation
- lint
- typecheck
- automated unit/integration/component tests
- production build
- selected Playwright journeys
- migration validation
- controlled migration deployment approval
- deployment verification and rollback strategy

## 9. Rate limiting and abuse prevention

Status: NOT IMPLEMENTED

Required before public beta:

- authentication-sensitive limits
- upload-creation and video-sync limits
- admin high-impact operation limits where appropriate
- booking limits
- AI-cost limits
- public API abuse controls

Abuse prevention and business quotas must remain separate concepts.

## 10. Security and RLS

Status: PARTIAL

Existing:

- server-side authentication
- service authorization patterns
- request-origin checks
- validation
- provider webhook signature verification

Required:

- admin privilege-escalation review
- account-state bypass tests
- complete authorization matrix
- Mux review/public playback threat review
- security headers
- dependency/security review
- sensitive logging review
- table-specific RLS evaluation
- threat-model review

RLS is introduced only where a table-specific threat model shows meaningful
defense in depth. Application authorization remains the primary current
boundary.

## 11. Caching and CDN

Status: NOT YET REQUIRED FOR CORE FUNCTIONALITY

Required strategy:

- static asset CDN via hosting platform
- public teacher discovery caching
- cache invalidation rules
- no caching of private/session/admin-review data
- media CDN behavior coordinated with Mux playback policy

Caching must follow correctness, not precede it.

## 12. Load balancing and scaling

Status: MANAGED INFRASTRUCTURE

Takineo should initially rely on hosting and managed providers for generic load
balancing. Application responsibilities include:

- stateless web requests where possible
- database connection pooling
- safe concurrent booking
- queue/background boundaries for heavy work
- provider retry/idempotency behavior

## 13. Error tracking, logs, and audit

Status: NOT IMPLEMENTED

Required:

- error tracking platform
- structured server logs
- environment/release tags
- request correlation where practical
- provider failure and cleanup visibility
- privacy-safe logging
- immutable admin/review audit events
- alerting for high-impact workflow failures

## 14. Availability and recovery

Status: NOT IMPLEMENTED

Required:

- health and readiness behavior
- production monitoring
- database backup verification
- database restore exercise
- deployment rollback
- provider outage behavior
- incident runbook
- data recovery procedures
- critical workflow idempotency

## Public beta release gate

Takineo must not be considered public-beta ready until:

- teacher review and approval work securely
- teacher discovery works using the full public-eligibility predicate
- availability works
- double booking is prevented
- booking works
- speaking sessions work
- report workflow works at the required MVP level
- production authentication and admin authorization are reviewed
- rate limiting is enabled
- observability is enabled
- backups and recovery are documented and tested
- production migration execution is controlled
- security review is completed
- production environment is isolated
- CI/CD passes
- core localized E2E journeys pass
