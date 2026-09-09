# Teacher Introduction Video

Teacher introduction videos are stored and processed by Mux.

Video bytes do not pass through the Takineo application server. The browser
uploads directly to a temporary authenticated Mux Direct Upload URL created by
an authorized Takineo server workflow.

## Applicant requirements

- Minimum processed duration: 60 seconds
- Maximum processed duration: 120 seconds
- Maximum client file size: approximately 500 MB
- Only teacher applications in `DRAFT` or `REJECTED` may upload or replace
- The teacher profile must be completed before upload creation
- One current introduction-video record per teacher profile
- Public playback is not created during applicant upload
- Processed provider duration, not client-declared duration, is authoritative

## Environment variables

Local and deployed server environments require:

- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_WEBHOOK_SECRET`
- `INTERNAL_JOB_SECRET`: server-only secret (at least 32 characters) protecting
  the internal Mux playback reconciliation job endpoint

Wave 1 signed playback will additionally require server-only Mux signing
configuration:

- `MUX_SIGNING_KEY`: Mux signing key ID
- `MUX_PRIVATE_KEY`: the corresponding RSA private key, supplied either as a
  PEM value or its base64-encoded PEM representation as accepted by the Mux
  Node SDK. Deployment secret stores should preserve the complete key and PEM
  line breaks/encoding.

Mux credentials and signing keys must never be exposed through `NEXT_PUBLIC_*`
variables or returned to the client.

## Current upload and processing lifecycle

```text
UPLOAD_PENDING
-> PROCESSING
-> READY_FOR_REVIEW
```

Provider or validation failures may instead produce:

```text
UPLOAD_PENDING / PROCESSING
-> FAILED

PROCESSING
-> REJECTED (processed duration outside 60-120 seconds)
```

Current behavior includes:

1. The authenticated teacher requests an upload.
2. The server verifies teacher ownership, completed profile, and editable
   application state.
3. The server creates a Mux Direct Upload using server-only credentials.
4. The browser uploads directly to Mux.
5. Signed Mux webhooks update processing state.
6. An authenticated provider-sync endpoint can recover from missed webhooks.
7. Processed duration is validated server-side.

Webhook processing must remain signature-verified, retry-safe, and matched to
Takineo-owned provider identifiers. Duplicate delivery must not corrupt state.

## Wave 1 review lifecycle

`READY_FOR_REVIEW` does not mean public. Pending videos must use signed/private
administrative review playback:

- an authenticated authorized administrator requests playback
- the server returns only a short-lived playback token and required playback
  data
- Mux signing credentials remain server-only
- review responses are not publicly cacheable

Administrative video review may transition the current reviewed video to:

```text
READY_FOR_REVIEW -> APPROVED
READY_FOR_REVIEW -> REJECTED
```

A video rejection retains its reason and allows replacement after the
application returns to an editable state. Every replacement requires review.

## Public playback

Final application approval may create a separate public playback ID for the
approved public teacher profile. The signed/private review playback identifier
and public playback identifier are distinct pieces of state.

Public playback must not be created unless the complete teacher approval
invariant passes. It must be revoked or removed when required by video
replacement, video rejection, teacher suspension, account moderation, or asset
withdrawal.

Each replacement increments a monotonic video revision. Public playback
enable/revoke work is persisted per video revision with desired state,
monotonic intent generation, attempt count, next-attempt time, lease token and
expiry, status, provider identifiers, and a safe last-error code. Provider
calls are reconciled from this durable state; a live playback identifier is
retained until provider deletion is confirmed.

The processor conditionally leases bounded batches of due work. Completion is
accepted only while the lease, intent generation, and target video revision
still match. Failures retain durable intent and retry with exponential backoff
(starting at 30 seconds and capped at one hour); expired leases become eligible
for another worker. A provider effect from a stale lease requeues and advances
the current intent without changing its desired state. Reconciliation inspects
the authoritative Mux asset so it
can adopt a public playback ID created before a failed database write, remove
duplicate public IDs, and revoke provider IDs even when the local playback ID
is missing. Signed review IDs are not treated as public IDs.

Successful intents remain periodically verifiable: `SUCCEEDED` schedules its
next authoritative check five minutes later. Scheduled processing includes due
terminal rows, and manual `--id` replay forces terminal verification while
respecting active leases. This repairs missing, obsolete, or duplicate public
IDs even if a superseded worker performs a provider mutation and exits before
it can update database intent.

Operations may replay one reconciliation or a bounded due batch with:

```text
npm run ops:mux-reconcile -- --id <reconciliation-id>
npm run ops:mux-reconcile -- --limit <1-50>
```

A future scheduler can call:

```text
POST /api/internal/jobs/mux-playback-reconciliation
x-takineo-job-secret: <INTERNAL_JOB_SECRET>
```

The endpoint returns safe batch counts and is not a user endpoint. No hosting
scheduler is deployed by this foundation; production deployment owns attaching
a scheduler to this protected endpoint and monitoring failures.

The binding Wave 1 lifecycle and security contract is
[admin-review-contract.md](engineering/admin-review-contract.md).

## Failure and cleanup behavior

- A provider failure must not falsely mark a video approved or public.
- Cleanup must be retry-safe and observable.
- A failed cleanup must not make stale public playback acceptable indefinitely.
- Signed review playback IDs are deleted after approval, video rejection, or
  replacement when possible. Database references are cleared only after
  provider-confirmed deletion in the shared cleanup helper. If cleanup after a
  replacement cannot complete, no new signed token is issued for that obsolete
  target and previously issued tokens retain their short expiry.
- A first-upload eligibility race never attaches the upload or returns its URL.
  The server attempts to cancel the Mux direct upload; because its URL was never
  disclosed, an unsuccessful cancellation leaves an unusable upload that
  expires under the provider upload timeout rather than a usable teacher video.
- Logs must not contain upload URLs, signing keys, private playback tokens, or
  unnecessary media metadata.
- Rate limiting is required before public beta for upload creation and manual
  provider synchronization.
