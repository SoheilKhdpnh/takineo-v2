# Teacher Application Workflow

Selecting the `TEACHER` product role does not make a user a public or bookable
teacher. It creates a private teacher application workspace.

Administrative access is separate from the `STUDENT`/`TEACHER` product role and
is never selectable during onboarding.

## Application states

### `DRAFT`

The applicant may:

- complete or edit the professional profile
- upload or replace the introduction video after completing the profile
- submit the completed application

The applicant may not:

- create availability
- appear in teacher discovery
- receive bookings

### `PENDING_REVIEW`

The application is waiting for administrative review. The submitted profile
and current video are locked against applicant changes during the review cycle.

The applicant may not create availability, appear publicly, or receive
bookings.

### `APPROVED`

The teacher has passed review. Final application approval requires both an
acceptable profile and an `APPROVED` current introduction video.

Public teacher eligibility additionally requires:

```text
accountStatus = ACTIVE
AND applicationStatus = APPROVED
AND profileCompletedAt is not null
AND introVideo.status = APPROVED
```

Availability and booking systems are not implemented yet.

### `REJECTED`

The applicant may read the applicable review outcome, correct rejected profile
content, replace a rejected video, and resubmit after readiness requirements
pass.

Review supports rejection of `PROFILE`, `VIDEO`, or `BOTH`:

- Profile-only rejection keeps an already approved unchanged video approved.
- Video rejection retains the video reason and requires a replacement to pass
  review.
- Both rejection applies both behaviors.

Prior review history remains immutable and auditable rather than being replaced
only by the latest note.

### `SUSPENDED`

Teacher-specific suspension removes teacher approval/public capabilities. It is
distinct from full account suspension.

The teacher is not publicly visible and cannot receive new bookings. Exact
effects on future booking records will be defined with the booking system.

## Submission

The current foundation permits submission from `DRAFT` or `REJECTED` only when:

- the professional profile is complete
- a current video exists
- the current video has completed processing and is acceptable for review

Submission changes the application to `PENDING_REVIEW` through a server-side
compare-and-set workflow. The browser is never authoritative for application
state.

## Administrative review

Wave 1 introduces separate profile and video review decisions, immutable audit
history, and transactionally safe final approval.

The application must never become `APPROVED` while the required current video
is not `APPROVED`. Concurrent or stale review actions must fail with stable state
conflicts rather than overwriting a newer decision.

The full binding behavior is defined in
[admin-review-contract.md](engineering/admin-review-contract.md).

## Role switching

Switching a teacher applicant to the student product role is not implemented.
It may be considered as a future product requirement, but no current UI or API
should claim that it is available.

## Authorization

Teacher-role access is insufficient for public teacher capabilities.

Every applicant mutation derives the teacher identity from an authenticated
server-side session, validates current application state, and operates only on
that user's profile/video. Every administrative action separately requires
server-controlled admin authorization.
