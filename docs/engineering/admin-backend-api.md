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
  submittedAparatHash: string | null;
  videoVerificationCode: string | null;
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
    aparatUrl: string | null;
    aparatHash: string | null;
    revision: number;
    status: TeacherIntroVideoStatus;
    rejectionReason: string | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
};
```

The detail DTO includes the submitted Aparat URL, canonical hash, and the
expected spoken verification code. Reviewers watch Aparat’s public embed; there
is no signed playback token. `UPLOAD_PENDING`, `PROCESSING`, and `FAILED` remain
on the enum for retired Mux-era rows and must not be treated as a current
reviewable Aparat submission.

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

The server additionally compares the submitted Aparat hash. Any
changed cycle, profile revision, video row/revision, Aparat hash, status, or
target account state fails with `409 REVIEW_STATE_CONFLICT`.

## Aparat review playback

There is no `POST .../playback` endpoint. The detail DTO is enough to embed
Aparat’s public player and show `videoVerificationCode` beside it. Approval
controls Talkinu visibility only; it cannot hide or delete the video on Aparat.

## Approve

`POST /api/admin/teacher-applications/:applicationId/approve`

Body: `ReviewGuard & { spokenCodeConfirmed: true }`. Success: `{ application: ApplicationDetail }`.
Approval accepts an unchanged submitted video in `READY_FOR_REVIEW` or already
`APPROVED`, requires an `ACTIVE` target account, a completed unchanged profile,
and an explicit spoken-code confirmation. It atomically approves the
video/application. Talkinu does not create, hide, or delete the video on Aparat.

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
`REJECTED` and requires a replacement Aparat link. Talkinu cannot revoke the
underlying Aparat video.

## Teacher moderation index

`GET /api/admin/teachers?status=APPROVED|SUSPENDED&limit=20&cursor=<teacherProfileId>`

This endpoint is discoverability support for ongoing teacher suspension and
reinstatement. It requires `SUPER_ADMIN` / `MODERATE_TEACHER`; reviewers cannot
enumerate it. `status` is required and accepts only `APPROVED` or `SUSPENDED`.
`limit` defaults to 20 and is an integer from 1 through 50. `cursor` is the
teacher-profile CUID of the last item from the previous page. Results are
ordered by `applicationReviewedAt` descending and then `id` descending.

```ts
type ModerationIndexResponse = {
  teachers: Array<{
    id: string;
    headline: string | null;
    applicationStatus: "APPROVED" | "SUSPENDED";
    applicationReviewedAt: string | null;
    reviewCycle: number;
    updatedAt: string;
    user: {
      name: string;
      email: string;
      accountStatus: AccountStatus;
    };
  }>;
  nextCursor: string | null;
};
```

The index intentionally excludes intro-video URLs, verification codes, submitted
Aparat hashes, audit metadata, and admin capability data. The detail endpoint
remains authoritative before a mutation; index state is only a discoverability
snapshot and may become stale.

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
account. Suspension removes Talkinu eligibility; reinstatement restores it.
Neither action can change the video on Aparat.

## Status-dependent actions

- `PENDING_REVIEW`: detail, Aparat embed, approve, reject.
- `APPROVED`: `SUPER_ADMIN` may suspend.
- `SUSPENDED`: `SUPER_ADMIN` may reinstate only while target account is active.
- `DRAFT`/`REJECTED`: detail only; applicant correction/resubmission owns the
  next transition.
- Inactive administrator: no admin operation.
- Inactive target account: never final approval or reinstatement.

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
    | "INTERNAL_SERVER_ERROR";       // 500
  issues?: Record<string, string[]>;
};
```

Mux playback reconciliation has been removed. Do not reintroduce
`ops:mux-reconcile`, Mux webhooks, or `MUX_*` secrets. See
`docs/engineering/vendor-eligibility.md`.

## Provisioning, account moderation, and secrets

No browser endpoint grants admin access or changes account status.
`bootstrapInitialSuperAdmin` requires an existing active user, an empty active
admin set, the literal privileged confirmation, and emits audit history.
`setAdministrativeAccess` and `setAccountStatus` require an active
`SUPER_ADMIN`, emit audits, and use serializable transactions. The last active
`SUPER_ADMIN` cannot be revoked, demoted, suspended, or disabled.

No Mux signing keys are required. Applicant video DTOs expose the canonical
Aparat URL needed for the teacher's own preview; admin detail also returns the
verification code used for spoken-code confirmation.
