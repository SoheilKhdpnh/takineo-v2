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

Wave 1 signed playback will additionally require server-only Mux signing
configuration. Exact variable names belong to implementation/environment
validation when that work is assigned.

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

The binding Wave 1 lifecycle and security contract is
[admin-review-contract.md](engineering/admin-review-contract.md).

## Failure and cleanup behavior

- A provider failure must not falsely mark a video approved or public.
- Cleanup must be retry-safe and observable.
- A failed cleanup must not make stale public playback acceptable indefinitely.
- Logs must not contain upload URLs, signing keys, private playback tokens, or
  unnecessary media metadata.
- Rate limiting is required before public beta for upload creation and manual
  provider synchronization.
