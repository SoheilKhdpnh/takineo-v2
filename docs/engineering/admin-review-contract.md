# Admin and Teacher Review Contract

## Status

This document is the binding shared architecture contract for Wave 1.

It defines required behavior and boundaries. It does not prescribe the final
Prisma representation, Route Handler paths, or UI design, and it does not
authorize implementation outside an assigned Wave 1 task.

## Core invariants

- `User.role` remains the product-facing `STUDENT` or `TEACHER` role.
- Administrative access is separate from product role selection.
- A browser or ordinary user request can never grant administrative access or
  change account moderation state.
- A teacher applicant is not a public teacher merely because
  `User.role = TEACHER`.
- A teacher application can never become `APPROVED` unless the profile is
  accepted and its required introduction video is `APPROVED`.
- Review state is authoritative only when produced by an authenticated,
  authorized, validated server-side workflow.
- Review history and administrative permission changes are auditable.

## 1. Administrative identity boundary

Administrative access is a server-controlled capability linked to an existing
Takineo `User`. It is not a value in the user-selectable `UserRole` enum.

An administrator may also have an ordinary product role. Product-role access
and administrative access must be evaluated independently. Having a student or
teacher product role neither grants nor prevents administrative access.

The following paths must never assign administrative access:

- signup
- product-role onboarding
- student or teacher profile editing
- client-provided session state
- public request payloads
- hidden or visible UI controls without a privileged server-side operation

Admin pages and endpoints must verify administrative access on the server for
every request. Route visibility and client-side navigation are not
authorization.

## 2. Permission levels

Wave 1 defines two administrative permission levels:

### `REVIEWER`

A reviewer may:

- view the pending teacher-application queue
- view the review detail needed to evaluate an application
- request short-lived signed playback for a pending introduction video
- approve or reject profile and video review decisions according to this
  contract

A reviewer may not:

- grant or revoke administrative access
- change another administrator's permission level
- bootstrap an administrator
- perform account-level moderation
- suspend or reinstate an approved teacher unless a later explicit contract
  delegates that capability

### `SUPER_ADMIN`

A super administrator has reviewer permissions and is the privileged authority
for:

- granting, revoking, or changing administrative access after bootstrap
- account-level moderation
- teacher suspension and reinstatement foundations
- other explicitly defined high-impact administrative operations

All authorization is enforced in server-side policy/service boundaries. The UI
may reflect permissions for usability but is never the only enforcement point.

## 3. Provisioning boundary

The first administrator will be linked to an already-existing Takineo user by a
controlled server-side bootstrap mechanism.

The bootstrap mechanism must:

- require explicit privileged execution
- run outside ordinary browser UI
- identify an existing user unambiguously
- fail safely if the target user or requested state is invalid
- avoid logging secrets or credentials
- produce an audit record

There must be no public admin-registration page, `ADMIN` onboarding choice,
public "become admin" endpoint, or client-controlled administrative assignment.

The bootstrap mechanism is not implemented by this document. After bootstrap,
administrative permission changes require `SUPER_ADMIN` authorization and an
audit record.

## 4. Account activity model

Wave 1 introduces a server-controlled account moderation concept with these
intended states:

- `ACTIVE`
- `SUSPENDED`
- `DISABLED`

Account state is not client-selectable and must not be accepted from signup,
onboarding, or profile-editing payloads.

Meanings:

- `ACTIVE`: the account may use capabilities otherwise allowed by its product
  role, application state, and administrative permissions.
- `SUSPENDED`: access is restricted by Takineo moderation and the account is not
  eligible for public teacher visibility.
- `DISABLED`: the account is disabled and is not eligible for product or
  administrative activity except any deliberately defined recovery process.

Teacher-specific `TeacherApplicationStatus.SUSPENDED` and account-level
`AccountStatus.SUSPENDED` are distinct:

- Teacher suspension removes teacher-specific approval/public capabilities but
  does not, by itself, define the whole account's status.
- Account suspension applies to the account as a whole and overrides teacher
  eligibility.

### Applicant-facing suspension and reinstatement feedback

The administrator-entered reason required for teacher suspension or
reinstatement is internal operator/audit data. It is not applicant-facing
content and must not be serialized into teacher-facing client payloads.

Applicant presentation is intentionally status-based:

- `SUSPENDED` shows a localized generic explanation that teaching access and
  public teacher visibility are paused, with a support path for next steps.
- Reinstatement returns the application to `APPROVED`; the applicant sees the
  normal localized approved/active state, not the administrator-entered
  reinstatement reason or moderation history.
- Exact applicant review feedback remains visible only for `REJECTED` review
  outcomes. A latest-note field that contains moderation text must be gated
  server-side before data crosses into a client component.

Administrative capabilities must not remain usable by a suspended or disabled
linked account.

Public teacher eligibility eventually requires all of:

```text
accountStatus = ACTIVE
AND applicationStatus = APPROVED
AND profileCompletedAt is not null
AND introVideo.status = APPROVED
```

Public-query services must enforce the complete predicate server-side rather
than filtering only in the UI.

## 5. Teacher review semantics

Teacher profile review and introduction-video review are logically separate
decisions. Final application approval combines them.

An application submitted from `DRAFT` or `REJECTED` enters `PENDING_REVIEW`.
While pending, applicant-controlled profile and video changes remain locked.

Review supports these rejection targets:

- `PROFILE`
- `VIDEO`
- `BOTH`

The server derives all resulting states. A client may request an allowed review
action and provide validated review input, but it may not submit authoritative
status values or reviewer identity.

### Approval

Application approval must be one transactionally safe server-side transition.
It may complete only when:

- the application is still `PENDING_REVIEW`
- the reviewed profile is accepted and remains the reviewed version
- the required current introduction video is the reviewed video
- that video is `APPROVED`
- the target records have not been replaced or concurrently changed

The application must never be `APPROVED` while its required video is not
`APPROVED`.

### Profile rejection

When only the profile is rejected:

- the application becomes `REJECTED`
- the profile rejection reason is retained in immutable review history
- the teacher may correct the profile after the application returns to an
  editable state
- an already `APPROVED` introduction video remains `APPROVED`
- the same approved video may be used on resubmission

### Video rejection

When the video is rejected:

- the application becomes `REJECTED`
- the reviewed video becomes `REJECTED`
- the video rejection reason is retained
- the teacher may replace the video after the application becomes editable
- a replacement is a new review subject and must pass review
- any public playback associated with the rejected/replaced video is revoked as
  required by the playback lifecycle

### Rejection of both

When both are rejected, both sets of behavior apply. Reasons must be attributable
to the relevant target so the applicant and audit history do not conflate
profile and video problems.

## 6. Resubmission behavior

A rejected applicant may edit only the rejected/correctable application parts
allowed by the resulting state and may resubmit after all readiness rules pass.

On resubmission:

- the application returns to `PENDING_REVIEW`
- the submitted profile version and current video identity are fixed review
  inputs for that review cycle
- a previously approved, unchanged video remains approved and need not be
  uploaded again when only the profile was rejected
- a rejected or replaced video must be processed and reviewed again
- prior decisions and reasons remain in immutable history
- the latest applicant-facing state may change without deleting earlier review
  records

Role switching from teacher applicant to student is not implemented. It remains
a possible future product requirement and is outside Wave 1 unless separately
specified.

## 7. Audit requirements

Administrative review and permission changes require immutable audit records.
At minimum, each record must make it possible to determine:

- actor
- target user, application, profile, video, or admin-access record
- action
- timestamp
- review cycle or relevant before/after state
- rejection/suspension reason where required
- relevant non-secret metadata needed for investigation

Required auditable actions include:

- profile approval or rejection
- video approval or rejection
- final application approval or rejection
- teacher suspension or reinstatement
- account moderation changes
- admin bootstrap
- admin access grant, revocation, or permission change

Audit history must not be represented only by overwriting the latest review
note. Audit records must not contain passwords, auth cookies, access tokens,
Mux signing keys, private upload URLs, or unnecessary personal/media data.

## 8. Mux signed administrative review playback

Pending teacher videos must not be publicly playable.

For administrative review:

1. An authenticated admin requests playback for a specific reviewable video.
2. The server verifies account activity, admin permission, application/video
   relationship, and review eligibility.
3. The server creates or uses the video's signed/private review playback
   identifier according to the provider lifecycle.
4. The server produces a short-lived playback token.
5. The client receives only the data required for authorized playback.

Mux signing secrets and private keys remain server-only. The client never
receives signing credentials. Review playback responses must not be publicly
cacheable and must not turn a pending video into a public asset.

Provider identifiers from a request or webhook must be matched to Takineo-owned
records. Signed webhook delivery does not remove the need to verify internal
asset/application relationships.

## 9. Public playback lifecycle

Signed administrative-review playback and public teacher-profile playback are
separate capabilities and identifiers, even when they refer to the same Mux
asset.

After final teacher approval, Takineo may create a separate `PUBLIC` playback ID
for the approved public teacher profile. Public playback creation must occur
only through a server-side workflow that confirms the full approval invariant.

The public playback identifier must be stored separately from signed-review
playback state.

Public playback must be revoked or removed when appropriate, including:

- the approved video is replaced
- the video is rejected
- teacher approval is suspended
- account moderation makes the teacher ineligible
- the asset is otherwise withdrawn

State transitions and provider cleanup must be retry-safe. A provider cleanup
failure must be observable and recoverable; stale public playback must not be
treated as acceptable indefinite access.

## 10. Conceptual backend contracts

Wave 1 backend interfaces must provide stable conceptual operations for:

- retrieving a paginated/filterable pending application queue
- retrieving one reviewable application detail
- requesting authorized short-lived review playback
- submitting a profile/video approval decision
- rejecting `PROFILE`, `VIDEO`, or `BOTH` with validated reasons
- completing final application approval
- establishing teacher suspension/reinstatement foundations
- retrieving the applicant-visible current review outcome

Exact HTTP paths and response shapes must be agreed before frontend integration.
Regardless of path, each protected mutation follows:

```text
Route Handler
→ authentication
→ account/admin authorization
→ origin/security validation
→ input validation
→ service transaction/state transition
→ Prisma and/or Mux
→ stable HTTP/error mapping
```

Contracts must:

- use session-derived actor identity
- validate all identifiers, filters, actions, targets, and reasons
- return stable machine-readable error codes
- distinguish unauthorized, forbidden, not found, invalid input, state conflict,
  and provider failure
- avoid leaking secrets, private upload URLs, or unrelated personal data
- use deliberate pagination/order for queues
- prevent clients from supplying authoritative reviewer IDs or resulting states

Route Handlers remain transport adapters and must not query Prisma directly.

## 11. Authorization matrix

`Allow` below means only the listed conceptual administrative capability. All
operations still require an authenticated, active account and valid current
state.

| Actor | Admin queue/detail | Signed review playback | Approve/reject review | Teacher suspension | Account moderation | Admin access changes |
| --- | --- | --- | --- | --- | --- | --- |
| Unauthenticated | Deny | Deny | Deny | Deny | Deny | Deny |
| Student without admin access | Deny | Deny | Deny | Deny | Deny | Deny |
| Teacher `DRAFT` without admin access | Deny | Deny | Deny | Deny | Deny | Deny |
| Teacher `PENDING_REVIEW` without admin access | Deny | Deny | Deny | Deny | Deny | Deny |
| Teacher `APPROVED` without admin access | Deny | Deny | Deny | Deny | Deny | Deny |
| Teacher `REJECTED` without admin access | Deny | Deny | Deny | Deny | Deny | Deny |
| Teacher `SUSPENDED` without admin access | Deny | Deny | Deny | Deny | Deny | Deny |
| `REVIEWER` | Allow | Allow | Allow | Deny | Deny | Deny |
| `SUPER_ADMIN` | Allow | Allow | Allow | Allow | Allow | Allow |

Administrative access linked to a product-role user is governed by the admin
permission row/capability, not by that user's product role. A suspended or
disabled account is denied even if administrative access still exists in data.

## 12. Concurrency and transaction requirements

Review operations must be safe under duplicate submissions, concurrent admins,
applicant/provider updates, and retried external-provider work.

Required properties:

- State transitions condition on the expected current application, profile, and
  video identities/states.
- Final approval and its authoritative database/audit changes are atomic.
- Two reviewers cannot both successfully apply incompatible decisions to the
  same review cycle.
- A stale browser cannot approve a replaced video or superseded application
  submission.
- Audit records are committed with the state transition they describe.
- Mux playback creation/removal is idempotent or safely retryable.
- Provider calls are not allowed to leave database state falsely claiming that
  required provider cleanup succeeded.
- Stable state-conflict errors are returned for stale or duplicate decisions.

The implementation may use transactions, compare-and-set conditions, versioned
review cycles, idempotency keys, or a coordinated combination. The selected
mechanism must be tested.

## 13. Testing contract

Wave 1 uses:

- Vitest for unit, domain, and appropriate service-level tests
- React Testing Library for applicable React component tests
- Playwright for browser end-to-end tests

Database integration tests use only an explicitly configured
`TEST_DATABASE_URL`. Test infrastructure must fail closed when a safe test
database is not configured. `DATABASE_URL` and `DIRECT_URL` must never be test
fallbacks.

Authorization tests must cover at least:

- unauthenticated user
- student
- teacher in each of `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`, and
  `SUSPENDED`
- `REVIEWER`
- `SUPER_ADMIN`

State, transaction, duplicate-action, audit, video-ownership, and playback
revocation behavior require focused tests.

## 14. Wave 1 ownership boundaries

### Backend / Admin agent

Owns the admin-access, account-state, review/audit, service, API, Prisma, and
migration implementation defined by this contract. It publishes agreed API
shapes before frontend integration and does not redesign unrelated product
roles or future booking systems.

### Frontend / UX agent

Owns localized admin queue/detail/review UI against agreed backend contracts,
including loading, error, empty, confirmation, accessibility, and RTL/LTR
states. It does not implement business authorization in React or access Prisma
directly.

### Security agent

Reviews the shared backend/frontend implementation for privilege escalation,
object substitution, origin protection, account-state bypass, concurrent review
actions, Mux playback leakage, secret handling, and audit integrity. It does not
independently redesign shared schema/contracts while implementation is active.

### QA / Testing-foundation agent

Owns safe test configuration, factories, authorization/state matrices, and
review-focused integration/E2E coverage. It must not allow test tooling to fall
back to development or production databases.

### Integration Lead

Owns shared contract changes, schema/interface conflict resolution, migration
ordering, cross-agent acceptance, and integration into `codex/integration`.

Any material change to these invariants, permissions, state transitions,
playback lifecycle, or agent boundaries requires integration-lead approval and a
contract update before implementation diverges.
