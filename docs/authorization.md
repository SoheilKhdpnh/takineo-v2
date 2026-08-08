# Authorization

Takineo separates authentication from application authorization.

## Authentication

Better Auth establishes the identity of the signed-in user. Sensitive
operations require a valid server-side session.

## Product roles

Takineo currently supports these product-facing roles:

- `STUDENT`
- `TEACHER`

A newly registered user has no product role until onboarding is complete.

Administrative access, introduced in Wave 1, is a separate server-managed
capability linked to a `User`. It is not a third product role and is not part of
role onboarding.

## Profile invariants

A valid student user has:

- `User.role = STUDENT`
- one related `StudentProfile`
- no `TeacherProfile`

A valid teacher user has:

- `User.role = TEACHER`
- one related `TeacherProfile`
- no `StudentProfile`

## Role assignment

The browser submits only the chosen product role. The server derives the user ID
from the authenticated session and creates the role and corresponding profile
as one atomic claim.

Role fields are configured as server-owned Better Auth fields and cannot be
supplied during registration. `ADMIN` must never be added as an onboarding
choice.

## Protected routes

Localized student routes are protected by:

- `app/[locale]/student/layout.tsx`

Localized teacher routes are protected by:

- `app/[locale]/teacher/layout.tsx`

Custom API routes perform their own authentication and authorization checks.
Route protection must not rely only on browser navigation, hidden links, layout
guards, or Proxy redirects.

## Teacher application authorization

Creating a teacher profile does not publish the teacher. New teacher profiles
begin with:

```text
applicationStatus = DRAFT
```

The lifecycle is:

```text
DRAFT -> PENDING_REVIEW -> APPROVED
                        -> REJECTED
                        -> SUSPENDED
```

- `DRAFT`: private applicant profile; editable
- `PENDING_REVIEW`: submitted and locked pending admin review
- `APPROVED`: application review passed, subject to all other eligibility rules
- `REJECTED`: changes are required and resubmission is permitted when ready
- `SUSPENDED`: teacher-specific approval/public capability is withdrawn

`role = TEACHER` alone never authorizes public listing, availability, booking,
or other approved-teacher activity.

Public teacher eligibility eventually requires:

```text
accountStatus = ACTIVE
AND applicationStatus = APPROVED
AND profileCompletedAt is not null
AND introVideo.status = APPROVED
```

## Account moderation

Wave 1 introduces server-controlled `ACTIVE`, `SUSPENDED`, and `DISABLED`
account states. Account moderation is distinct from teacher-specific application
suspension and overrides public teacher eligibility.

Account state is never accepted from signup, onboarding, or profile payloads.

## Administrative authorization

Administrative permission levels are `REVIEWER` and `SUPER_ADMIN`. They are
server-controlled and linked to an existing user independently of product role.

There is no public admin registration, public admin-grant endpoint, or
client-controlled admin assignment. The first admin uses an explicitly
privileged server-side bootstrap mechanism; later changes require authorized
`SUPER_ADMIN` action and audit history.

The binding review, permission, account, and playback rules are in
[admin-review-contract.md](engineering/admin-review-contract.md).

## Teacher applicant role switching

Changing a teacher applicant to the student product role is not implemented. It
remains a possible future product requirement. Current UI and API documentation
must not claim that it is available.
