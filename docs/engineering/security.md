# Security and Authorization

## Security model

Takineo uses layered security.

No single UI check, middleware check, service check, or database feature should be assumed to solve every security problem.

## Authentication

Better Auth identifies authenticated users.

Sensitive operations require a valid server-side session.

## Authorization

Authorization must be enforced server-side.

Do not trust:

- hidden buttons
- client state
- route visibility
- role text sent from the client

## Roles

Current product-facing roles:

- STUDENT
- TEACHER

Teacher is an application-side role, not automatic public approval.

Administrative authorization is introduced separately from product role and
must not be self-selectable during signup or onboarding. Wave 1 permissions are
`REVIEWER` and `SUPER_ADMIN`, linked to an existing user through server-controlled
state.

There must be no public admin registration, onboarding choice, or client-owned
admin assignment. Administrative checks are enforced server-side on every admin
page/API operation.

Wave 1 must follow
[`admin-review-contract.md`](admin-review-contract.md).

## Account moderation

Wave 1 introduces server-controlled `ACTIVE`, `SUSPENDED`, and `DISABLED`
account states. Account state is never client-selectable.

Teacher-specific suspension and full account suspension are separate. A
suspended/disabled account is ineligible for public teacher visibility and must
not retain usable administrative capability.

## Teacher approval

Teacher capabilities must depend on application state.

`role === "TEACHER"` alone must never authorize:

- public teacher listing
- availability publication
- bookings
- teacher-specific paid activity

## Same-origin protection

State-changing browser endpoints should use the project's trusted-origin protection where applicable.

This complements authentication.

It does not replace authorization.

## Input validation

Every untrusted input must be validated server-side.

Examples:

- request JSON
- query parameters
- route identifiers
- file/provider metadata
- administrative review input

## Secrets

Never expose server secrets via:

`NEXT_PUBLIC_*`

High-value secrets include:

- database credentials
- Better Auth secret
- Mux token secret
- Mux webhook secret
- Mux playback signing private keys
- future AI provider keys
- payment credentials

## Webhooks

Webhook endpoints must:

- verify provider signatures
- consume the correct raw body where required
- tolerate duplicate delivery
- return successful responses only after safe processing
- avoid trusting arbitrary provider identifiers without matching internal state

## Rate limiting

Rate limiting is required before public beta for at least:

- sign-in attempts
- sign-up attempts
- password/reset-sensitive flows where applicable
- upload creation
- video status synchronization
- booking mutations
- public high-cost APIs
- AI generation/analysis endpoints
- administrative high-impact operations where appropriate

Rate limits must distinguish abuse prevention from business quotas.

## Upload security

Large media bytes should upload directly to the media provider.

Takineo should validate:

- authenticated ownership
- application eligibility
- provider identifiers
- processed duration
- relevant media status

Do not trust client-declared duration as authoritative.

Pending teacher videos require signed/private admin review playback. The server
issues short-lived playback tokens after admin authorization; clients never
receive signing credentials. Public playback uses a separate identifier created
only after final approval and revoked when eligibility is withdrawn.

## Administrative actions

Administrative actions must record immutable audit history including:

- actor
- target
- action
- timestamp
- required reason where the action contract requires one
- relevant non-secret metadata and review-cycle/state context

High-impact actions include:

- teacher approval
- teacher rejection
- suspension
- account moderation
- sensitive manual overrides

Admin bootstrap and administrative permission grant, revocation, or level
changes are also high-impact auditable actions.

## RLS

PostgreSQL Row Level Security is not required merely as a checklist item.

Application authorization remains the primary current boundary because users do not connect directly to PostgreSQL.

Before public beta, evaluate RLS for particularly sensitive tables where it provides meaningful defense in depth.

If RLS is introduced:

- policies must be tested
- service/database credentials and bypass behavior must be understood
- migration and operational implications must be documented

Do not introduce blanket RLS without a table-specific threat model.

## Security headers

Production deployment should configure appropriate browser security headers including, where suitable:

- Content-Security-Policy
- Referrer-Policy
- X-Content-Type-Options
- frame embedding restrictions
- permissions policy

The exact CSP must account for approved external providers.

## Logging

Never log:

- passwords
- access tokens
- secrets
- full auth cookies
- private media upload URLs unnecessarily

Logs should contain useful identifiers without exposing credentials.

## Production security gate

Before public beta:

- authorization test suite passes
- rate limiting exists
- admin authorization is isolated
- security headers are reviewed
- secrets are production-isolated
- dependency/security audit is reviewed
- upload/webhook authorization is tested
- booking concurrency is tested
- sensitive logs are reviewed
