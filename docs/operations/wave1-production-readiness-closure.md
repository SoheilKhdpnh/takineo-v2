# Wave 1 Production-Readiness Closure

Date: 2026-08-15
Baseline entering closure: `cfb0a10`

## Decision

**Wave 1 Teacher Trust code/review scope: COMPLETE after M18 acceptance.**

**Takineo public beta: NOT READY.**

Those statements are intentionally different. Wave 1 now has a production-grade
application boundary for teacher trust/admin review, but the overall product
still depends on later product waves and the cross-cutting production-hardening
work listed in `production-readiness.md`.

## Evidence already established

The accepted Wave 1 sequence includes:

- server-controlled `REVIEWER` / `SUPER_ADMIN` authorization independent of
  product role
- localized accessible admin shell, review queue and review detail
- signed/private Mux review playback
- guarded profile/video/application decisions with stale snapshot protection
- moderation and applicant-safe rejection feedback
- locked teacher profile UX outside editable states
- public-playback reconciliation with leases/fences and scheduled monitoring
- dry-run-first operator workflows for administrative access/account status
- isolated PostgreSQL integration and Playwright E2E databases
- 5-case real-browser acceptance with Better Auth and PostgreSQL
- three-job GitHub CI enforcement
- independent adversarial security review with no unresolved Critical/High
  Wave 1 privilege-escalation finding

Before M18, the accepted regression baseline is:

- unit: 436/436
- integration: 94/94
- Playwright: 5/5
- Prisma validate/generate, ESLint, TypeScript and production build: passing

## M18 closure hardening

M18 adds only low-risk, verifiable release controls:

1. Next.js no longer advertises `X-Powered-By`.
2. Global `nosniff`, clickjacking, referrer and conservative permissions
   headers are configured.
3. Production emits a **report-only**, Mux-aware CSP. It is intentionally not
   enforcing until deployed reports are reviewed; converting an unobserved CSP
   into an enforcing policy would risk breaking Mux upload/playback or Next.js
   runtime behavior.
4. CI runs a repeatable high/critical production-dependency audit via
   `npm run security:audit:prod`.
5. A no-standing-bypass `SUPER_ADMIN` break-glass procedure is documented.
6. The canonical production-readiness and roadmap documents are updated to
   distinguish completed Wave 1 evidence from deployment/public-beta blockers.

## Items that remain BLOCKING for public beta

### Application/platform hardening

- shared/distributed abuse prevention for auth plus upload/video-sync, booking,
  administrative high-impact and future AI-cost surfaces
- enforced CSP after report-only validation
- HSTS after the canonical production domain/subdomain policy is finalized
- structured logging and error tracking
- table-specific RLS decision where it provides meaningful defense in depth
- release-candidate dependency audit review and remediation

### Operations/deployment evidence

- production/staging/preview isolation and canonical domain
- remote required checks / branch protection for `Quality`, `Integration`, and
  `Browser E2E`
- production secrets provisioned and rotation procedure verified
- deployed Netlify Mux schedule plus heartbeat/failure evidence
- controlled production migration owner/path
- database backup verification and restore exercise
- deployment rollback and incident exercise
- staging exercise of the break-glass runbook

### Product scope outside Wave 1

The public-beta gate also requires the later discovery, booking UI, speaking
session and learning/report flows described by the roadmap. Completing Wave 1
does not waive those requirements.

## Release classification

After M18 acceptance the correct classification is:

> **Wave 1 complete and regression-protected; safe to integrate forward. Not a
> public-beta release candidate yet.**

No deployment operator should reinterpret this document as permission to skip
`production-readiness.md`.
