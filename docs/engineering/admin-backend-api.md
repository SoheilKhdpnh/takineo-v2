# Wave 1 Admin Backend API

## Transport rules

Every endpoint requires a Better Auth session for an `ACTIVE` user with a
non-revoked `AdminAccess`. Review operations allow `REVIEWER` and
`SUPER_ADMIN`; moderation allows only `SUPER_ADMIN`. Mutations require the
trusted application `Origin`. Every success and expected error uses:

```http
Cache-Control: private, no-store
Content-Type: application/json
```

All timestamps are UTC ISO-8601 JSON strings. `null` below is explicit JSON
null. IDs are CUID strings. Unknown response fields must not be treated as an
authorization signal.

Enums:

- `AccountStatus`: `ACTIVE | SUSPENDED | DISABLED`
- `TeacherApplicationStatus`: `DRAFT | PENDING_REVIEW | APPROVED | REJECTED | SUSPENDED`
- `TeacherIntroVideoStatus`: `UPLOAD_PENDING | PROCESSING | READY_FOR_REVIEW | APPROVED | REJECTED | FAILED`
- `ReviewRejectionTarget`: `PROFILE | VIDEO | BOTH`
- `PlaybackDesiredState`: `ENABLED | REVOKED`
- `PlaybackReconciliationStatus`: `PENDING | PROCESSING | SUCCEEDED | FAILED`
- `Timezone`: `Asia_Tehran | Asia_Dubai | Europe_Berlin | Europe_Istanbul |
  Europe_London | America_Toronto | America_New_York | America_Chicago |
  America_Los_Angeles | UTC`

## Current administrator

`GET /api/admin/session`

```ts
type CurrentAdminResponse = {
  admin: {
    userId: string;
    permission: "REVIEWER" | "SUPER_ADMIN";
    capabilities: {
      reviewTeacherApplications: true;
      moderateTeachers: boolean;
      moderateAccounts: boolean;
      manageAdminAccess: boolean;
    };
  };
};
```

The three moderation/management booleans are true only for `SUPER_ADMIN`.
Frontend visibility may consume this contract, but every operation remains
server-authorized. Server Components may call `getCurrentAdminCapabilities`
directly after deriving the user ID from the server session.

## Queue

`GET /api/admin/teacher-applications?limit=20&cursor=<applicationId>`

`limit` defaults to 20 and is an integer from 1 through 50. `cursor` is the
CUID of the last item from the prior page. The queue contains only
`PENDING_REVIEW` applications, ordered by `applicationSubmittedAt` ascending
then `id` ascending. The cursor item is excluded. Clients must discard a cursor
when filters/query context changes.

```ts
type QueueResponse = {
  applications: Array<{
    id: string;
    reviewCycle: number;
    submittedProfileRevision: number | null;
    submittedVideoId: string | null;
    submittedVideoRevision: number | null;
    applicationSubmittedAt: string | null;
    user: {
      name: string;
      email: string;
      accountStatus: AccountStatus;
    };
    introVideo: null | {
      id: string;
      revision: number;
      status: TeacherIntroVideoStatus;
      durationSeconds: number | null;
    };
  }>;
  nextCursor: string | null;
};
```

`nextCursor = null` means there is no next page. Null snapshot/video fields are
possible only for malformed or concurrently changed data and must disable
review actions in the UI; the server will reject them as a state conflict.
`user.accountStatus` is a query-time snapshot, not a promise that the account
will remain active; mutations perform their own transactional checks.

## Detail DTO

`GET /api/admin/teacher-applications/:applicationId`

All approve/reject/moderation responses use `{ application: ApplicationDetail }`.

```ts
type ApplicationDetail = {
  id: string;
  userId: string;
  headline: string | null;
  bio: string | null;
  experienceYears: number | null;
  nativeLanguage: "fa" | "en" | "ar" | "tr" | "ku";
  teachingLanguage: string;
  timezone: Timezone;
  profileCompletedAt: string | null;
  profileRevision: number;
  applicationStatus: TeacherApplicationStatus;
  applicationSubmittedAt: string | null;
  applicationReviewedAt: string | null;
  applicationReviewNote: string | null;
  reviewCycle: number;
  submittedProfileRevision: number | null;
  submittedVideoId: string | null;
  submittedVideoRevision: number | null;
  submittedVideoUploadId: string | null;
  submittedVideoAssetId: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    accountStatus: AccountStatus;
  };
  introVideo: null | {
    id: string;
    provider: string;
    uploadId: string | null;
    assetId: string | null;
    publicPlaybackId: string | null;
    revision: number;
    status: TeacherIntroVideoStatus;
    durationSeconds: number | null;
    rejectionReason: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    createdAt: string;
    updatedAt: string;
    playbackReconciliations: Array<{
      videoRevision: number;
      desiredState: PlaybackDesiredState;
      intentGeneration: number;
      status: PlaybackReconciliationStatus;
      attemptCount: number;
      nextAttemptAt: string;
      leaseExpiresAt: string | null;
      lastErrorCode: string | null;
      lastAttemptAt: string | null;
    }>;
  };
};
```

The reconciliation array contains at most the most recently created record.
`FAILED` is durable and retryable by the server reconciliation service;
`lastErrorCode` is opaque, operational, non-secret metadata and must not drive
product behavior.

## Concurrency guard

Approve and reject clients must echo all four values from the same detail DTO:

```ts
type ReviewGuard = {
  reviewCycle: number;       // positive integer
  profileRevision: number;   // submittedProfileRevision
  videoId: string;           // submittedVideoId
  videoRevision: number;     // submittedVideoRevision
};
```

The server additionally compares the submitted upload ID and asset ID. Any
changed cycle, profile revision, video row/revision, upload, asset, status, or
target account state fails with `409 REVIEW_STATE_CONFLICT`.

## Signed review playback

`POST /api/admin/teacher-applications/:applicationId/playback` with no body.
Allowed only for the unchanged current submitted video in `READY_FOR_REVIEW` or
`APPROVED` while the application is `PENDING_REVIEW`.

```ts
type PlaybackResponse = {
  playback: {
    playbackId: string;
    token: string;
    expiresInSeconds: 300;
  };
};
```

The token and signed review playback ID are private. Applicant APIs do not
return `reviewPlaybackId`. Immediately before returning the token, the server
revalidates the active administrator, pending application cycle, profile/video
revisions, provider, upload, and asset. Rejected/replaced/finally approved
review IDs are deleted best-effort; failed deletion does not permit new tokens,
and already issued tokens expire after at most five minutes.

## Approve

`POST /api/admin/teacher-applications/:applicationId/approve`

Body: `ReviewGuard`. Success: `{ application: ApplicationDetail }`.
Approval accepts an unchanged submitted video in `READY_FOR_REVIEW` or already
`APPROVED`, requires an `ACTIVE` target account and completed unchanged profile,
and atomically approves the video/application. Public Mux playback is queued in
durable reconciliation. Provider failure does not roll back valid review state;
it appears as reconciliation `FAILED` and remains retryable.

## Reject

`POST /api/admin/teacher-applications/:applicationId/reject`

```ts
type RejectBody = ReviewGuard & {
  target: ReviewRejectionTarget;
  profileReason?: string; // required for PROFILE/BOTH; 3..2000 trimmed chars
  videoReason?: string;   // required for VIDEO/BOTH; 3..2000 trimmed chars
};
```

Success: `{ application: ApplicationDetail }`. Profile-only rejection promotes
`READY_FOR_REVIEW` video to `APPROVED` or preserves existing `APPROVED`, so the
same unchanged revision may be resubmitted. Video rejection marks that revision
`REJECTED` and durably requests public playback revocation.

## Teacher moderation

`POST /api/admin/teacher-applications/:applicationId/moderation`

```ts
type ModerationBody = {
  action: "SUSPEND" | "REINSTATE";
  reviewCycle: number; // non-negative integer
  reason: string;      // 3..2000 trimmed chars
};
```

Success: `{ application: ApplicationDetail }`. `SUSPEND` requires `APPROVED`;
`REINSTATE` requires `SUSPENDED`, an approved video, and an `ACTIVE` target
account. Suspension queues playback revocation; reinstatement queues enablement.

## Status-dependent actions

- `PENDING_REVIEW`: detail, signed playback, approve, reject.
- `APPROVED`: `SUPER_ADMIN` may suspend.
- `SUSPENDED`: `SUPER_ADMIN` may reinstate only while target account is active.
- `DRAFT`/`REJECTED`: detail only; applicant correction/resubmission owns the
  next transition.
- Inactive administrator: no admin operation.
- Inactive target account: never final approval, reinstatement, or public
  playback enablement.

## Stable errors

```ts
type ErrorResponse = {
  error:
    | "UNAUTHORIZED"                 // 401; missing session or inactive account
    | "ADMIN_FORBIDDEN"              // 403
    | "UNTRUSTED_ORIGIN"             // 403
    | "INVALID_REQUEST"              // 400; malformed ID/query/body
    | "APPLICATION_NOT_FOUND"        // 404
    | "REVIEW_STATE_CONFLICT"        // 409; stale/duplicate/invalid/P2034 serialization conflict
    | "REVIEW_PLAYBACK_UNAVAILABLE"  // 502; signed-review Mux/config failure
    | "INTERNAL_SERVER_ERROR";       // 500
  issues?: Record<string, string[]>;
};
```

Public-playback provider failures are not returned as false approval/rejection
failures. They are persisted as reconciliation `FAILED` with a safe operational
code and retried through the reconciliation processor.

## Mux playback reconciliation operations

Every desired-state change increments `intentGeneration`, resets retry state,
and invalidates any existing lease. Workers claim due rows with a UUID
`leaseToken` and 60-second `leaseExpiresAt`. Final database writes require the
same lease token, intent generation, and video revision. A stale worker may
complete an unavoidable provider call but cannot mark or erase newer intent;
an observed stale provider effect increments/requeues the current generation so
the newer desired state subsequently reconverges provider state.

Retries start at 30 seconds with exponential backoff capped at one hour.
Revocation always retrieves the authoritative Mux asset and removes every
`public` playback ID, including duplicates or IDs absent from local storage;
signed review IDs are distinguished by policy. Enablement adopts an existing
public ID or creates one, removes duplicates, and verifies full teacher
eligibility again before finalization.

Processing entry points:

- Server service: `processDueMuxPlaybackReconciliations(limit)` processes a
  bounded 1–50 row batch and returns safe selected/succeeded/failed/requeued/
  skipped counts.
- Manual replay: `npm run ops:mux-reconcile -- --limit 20`, or force one due
  intent with `npm run ops:mux-reconcile -- --id <reconciliation-cuid>`.
- Future scheduler endpoint: `POST /api/internal/jobs/mux-playback-reconciliation`
  with `X-Takineo-Job-Secret` and strict body `{ "limit": 20 }`.

The internal endpoint uses server-only `INTERNAL_JOB_SECRET` (minimum 32
characters), is not a user/admin browser API, and returns
`INTERNAL_JOB_UNAUTHORIZED`, `INTERNAL_JOB_NOT_CONFIGURED`, or
`INVALID_REQUEST` when applicable. The processor exists, but production
deployment must explicitly attach a scheduler; no scheduler is currently
deployed.

## Provisioning, account moderation, and secrets

No browser endpoint grants admin access or changes account status.
`bootstrapInitialSuperAdmin` requires an existing active user, an empty active
admin set, the literal privileged confirmation, and emits audit history.
`setAdministrativeAccess` and `setAccountStatus` require an active
`SUPER_ADMIN`, emit audits, and use serializable transactions. The last active
`SUPER_ADMIN` cannot be revoked, demoted, suspended, or disabled.

Signed playback requires server-only `MUX_SIGNING_KEY` and `MUX_PRIVATE_KEY`.
The private key may be PEM or base64-encoded PEM accepted by the Mux Node SDK.
Neither signing material nor `reviewPlaybackId` is returned by ordinary
applicant APIs.

Applicant application/video DTOs omit submitted/current upload IDs, asset IDs,
review playback IDs, and public provider playback IDs. Those identifiers remain
server/admin-only for concurrency, audit, and reconciliation.
