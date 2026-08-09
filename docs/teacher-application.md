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
state. Submission snapshots the monotonic profile revision and current video
row, revision, upload ID, and asset ID. Profile edits and video replacements use
conditional writes, so an edit/replacement racing submission cannot mutate the
submitted review target.

## Legacy migration

The Wave 1 migration does not infer current trust from the historical
`isVerified` flag alone. A legacy `APPROVED` or `SUSPENDED` application is
preserved only when the current profile is complete and the current Mux video
has nonblank, coherent upload/asset identifiers, a processed duration within
60-120 seconds, and a video state compatible with approved media. The migration
records the submitted profile/video snapshots required by the new review
invariant.

If that evidence is insufficient, the application becomes editable
`REJECTED` and must be explicitly resubmitted. Malformed legacy pending rows
also become `REJECTED`; unusable videos become replaceable `REJECTED` videos.
Dedicated legacy snapshot fields retain the previous application/video state,
application/video submitted timestamps, review note, video rejection reason,
review timestamps, and migration context for every pre-Wave 1 row—including
existing rejected and safely preserved states. Existing review history is not
overwritten by the migration context message, and migration normalization does
not invent a new administrative review timestamp.

Malformed terminal-looking media on editable `DRAFT`/`REJECTED` applications
is normalized to replaceable `REJECTED` media. Submission independently
requires exact Mux provider identity, canonical nonblank and distinct upload/
asset IDs, processed duration from 60 through 120 seconds, and a current
`READY_FOR_REVIEW` or `APPROVED` status. A legacy status label alone is never
sufficient.

The migration is enclosed in an explicit PostgreSQL transaction. Its deliberate
legacy-playback consistency guard raises before `COMMIT`, so any failure rolls
back all statements in the migration. Legacy public playback with unsupported
provider identity, blank/whitespace/noncanonical identifiers, or incoherent
Mux identifiers triggers this guard. The original source row remains intact so
an operator can verify/revoke provider state or repair the identity before
retrying. The migration must be exercised against a disposable PostgreSQL
upgrade database before deployment.

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
