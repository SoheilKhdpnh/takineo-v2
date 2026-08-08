# Wave 1 Admin Backend API

All endpoints require a Better Auth session whose linked `User` is `ACTIVE`
and has non-revoked `AdminAccess`. Mutations also require the trusted browser
origin. Responses containing review data or playback credentials are private
and must not be cached.

## Endpoints

- `GET /api/admin/teacher-applications?limit=20&cursor=...` — pending queue,
  ordered oldest submission first. Returns `applications` and `nextCursor`.
- `GET /api/admin/teacher-applications/:applicationId` — review detail.
- `POST /api/admin/teacher-applications/:applicationId/playback` — creates or
  reuses a signed Mux review playback ID and returns a five-minute token.
- `POST /api/admin/teacher-applications/:applicationId/approve` — body:
  `{ reviewCycle, videoId }`. Atomically approves profile, current video, and
  application after creating a separate public playback ID.
- `POST /api/admin/teacher-applications/:applicationId/reject` — body:
  `{ reviewCycle, videoId, target, profileReason?, videoReason? }`. `target` is
  `PROFILE`, `VIDEO`, or `BOTH`; corresponding reasons are required.
- `POST /api/admin/teacher-applications/:applicationId/moderation` —
  `SUPER_ADMIN` only; body `{ action: "SUSPEND" | "REINSTATE", reviewCycle,
  reason }`.

Clients must use the `reviewCycle` and `videoId` returned by queue/detail.
Stale or duplicate writes return `409 REVIEW_STATE_CONFLICT`. Expected error
codes also include `UNAUTHORIZED`, `ADMIN_FORBIDDEN`, `INVALID_REQUEST`,
`APPLICATION_NOT_FOUND`, `UNTRUSTED_ORIGIN`, and
`REVIEW_PLAYBACK_UNAVAILABLE`.

## Provisioning and secrets

There is no browser endpoint for administrative access. The server-only
`bootstrapInitialSuperAdmin` function requires an existing active user, an
empty active-admin set, and the literal privileged confirmation. An operator
wrapper should call it only from a controlled server environment.
Later permission and account-state changes use the server-only, SUPER_ADMIN
authorized `setAdministrativeAccess` and `setAccountStatus` services and always
append audit events; no public grant/moderation routes are exposed in Wave 1.

Signed review playback requires server-only `MUX_SIGNING_KEY` and
`MUX_PRIVATE_KEY` in addition to the existing Mux API credentials. Neither is
returned to clients. The database stores private review and public playback
IDs in separate columns.
