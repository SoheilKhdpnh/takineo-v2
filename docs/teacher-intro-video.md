# Teacher introduction video

Teacher introduction videos are stored and processed by Mux.

The video file does not pass through the Takineo application server.
The browser uploads directly to a temporary authenticated Mux Direct
Upload URL.

## Requirements

- Minimum duration: 60 seconds
- Maximum duration: 120 seconds
- Maximum client file size: approximately 500 MB
- Only teacher applications in `DRAFT` or `REJECTED` may upload
- One active introduction-video record per teacher profile
- Public playback is not created during upload

## Environment variables

Local and deployed server environments require:

- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_WEBHOOK_SECRET`

These values must never be exposed through `NEXT_PUBLIC_` variables.

## Lifecycle

```text
UPLOAD_PENDING
→ PROCESSING
→ READY_FOR_REVIEW
→ APPROVED