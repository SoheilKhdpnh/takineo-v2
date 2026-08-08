# Production Readiness

This document is the release gate for Takineo.

A feature-complete application is not automatically production-ready.

## 1. Frontend foundation

Status: FOUNDATION EXISTS

Required before public beta:

- responsive student UI
- responsive teacher UI
- responsive admin UI
- Persian/English
- RTL/LTR
- accessibility review
- loading/error/empty states
- browser compatibility pass

## 2. Backend

Status: FOUNDATION EXISTS

Current architecture:

Route Handler
→ validation/security
→ service
→ Prisma

Required:

- stable domain errors
- transactional booking
- idempotent webhooks
- asynchronous work boundaries
- controlled external-provider failures

## 3. Database

Status: FOUNDATION EXISTS

Current:

- PostgreSQL
- Neon
- Prisma
- migrations

Required:

- production migration workflow
- indexes reviewed
- query performance review
- booking constraints
- backup policy
- restore test
- migration rollback/recovery runbook

## 4. Storage and media

Status: PARTIAL

Current:

- Mux teacher video foundation

Required:

- production Mux environment
- secure production webhooks
- provider failure handling
- retention rules
- future recording/storage decision

## 5. Authentication and permissions

Status: PARTIAL / STRONG FOUNDATION

Current:

- Better Auth
- protected sessions
- role onboarding
- teacher application states

Required:

- administrator authorization
- email/account verification policy
- full authorization test matrix
- session/security review
- account moderation state

## 6. Hosting

Status: NOT FINALIZED

Required:

- production Next.js host
- canonical production domain
- environment isolation
- TLS
- deployment rollback procedure
- preview/staging strategy

## 7. Cloud and computing

Status: PARTIAL / MANAGED-SERVICE STRATEGY

Prefer managed infrastructure.

Required decisions:

- Next.js compute/runtime
- asynchronous job execution
- session/video/AI workload boundaries
- scheduled/background processing

## 8. CI/CD

Status: BASIC FOUNDATION

Required:

- GitHub CI
- lint
- typecheck
- automated tests
- production build
- migration validation
- controlled migration deployment
- deployment gate
- rollback strategy

## 9. Rate limiting and abuse prevention

Status: NOT IMPLEMENTED

Required before public beta:

- authentication limits
- upload-creation limits
- video-sync limits
- booking limits
- AI-cost limits
- public API abuse controls

## 10. Security and RLS

Status: PARTIAL

Existing:

- server-side authentication
- service authorization patterns
- request-origin checks
- validation
- provider webhook verification

Required:

- security headers
- dependency review
- admin security
- authorization tests
- logging review
- RLS table-by-table evaluation
- threat-model review

## 11. Caching and CDN

Status: NOT YET REQUIRED FOR CORE FUNCTIONALITY

Required strategy:

- static asset CDN via hosting platform
- public teacher discovery caching
- cache invalidation rules
- avoid caching private/session-specific data
- video CDN handled by media provider

Caching must follow correctness, not precede it.

## 12. Load balancing and scaling

Status: MANAGED INFRASTRUCTURE

Takineo should initially rely on the hosting platform and managed providers for generic load balancing.

Application responsibilities:

- stateless web requests where possible
- database connection pooling
- safe concurrent booking
- queue/background architecture for heavy jobs
- provider retry/idempotency behavior

## 13. Error tracking and logs

Status: NOT IMPLEMENTED

Required:

- error tracking platform
- structured server logs
- environment/release tags
- request correlation where practical
- provider failure visibility
- privacy-safe logging
- admin/audit events

## 14. Availability and recovery

Status: NOT IMPLEMENTED

Required:

- health/readiness endpoint
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

- teacher approval works
- teacher discovery works
- availability works
- double booking is prevented
- booking works
- speaking session works
- report workflow works at required MVP level
- production auth is reviewed
- rate limiting is enabled
- observability is enabled
- backups and recovery are documented/tested
- security review is completed
- production environment is isolated
- CI/CD passes
- core E2E journeys pass