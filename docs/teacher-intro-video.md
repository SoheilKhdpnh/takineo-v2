# Teacher Introduction Video

Teacher introduction videos are hosted on Aparat. Talkinu stores only a
validated `aparat.com` URL, a canonical video hash, and a short spoken
verification code tied to the teacher application.

Talkinu does not upload, transcode, or proxy video bytes.

This replaced Mux after Mux Terms §13.7 was confirmed to use the same OFAC
restricted-country warranty already found for OpenAI, Anthropic, Twilio, and
other U.S. vendors. See `docs/engineering/vendor-eligibility.md`.

## Applicant flow

1. A teacher reaches the introduction-video step after completing their
   professional profile.
2. Talkinu generates a 5-character verification code for that application if
   one does not already exist.
3. The teacher records on Aparat and, somewhere in the video, says:
   “This video is recorded for the Talkinu team” plus that exact code.
4. They paste an `https` Aparat watch or embed URL.
5. The server accepts the URL only when the host is `aparat.com`,
   `www.aparat.com`, or `m.aparat.com`, and a video hash can be parsed.
6. The checklist step is complete when a valid Aparat link is stored in
   `READY_FOR_REVIEW`.
7. Preview uses Aparat’s public embed iframe. There is no uploaded file to
   play natively.
8. “Manage introduction video” edits or replaces that submitted link.

Only applications in `DRAFT` or `REJECTED` may submit or replace a link.

## Reviewer flow

- The expected verification code is shown next to the embedded player.
- Approval requires an explicit checkbox:
  the reviewer confirmed the applicant said their code.
- Approval and rejection control Talkinu visibility only. They do not create,
  hide, or delete the video on Aparat.

## Deliberate tradeoffs versus Mux

These are accepted gaps, not silent omissions:

| Mux capability | Aparat-link replacement |
|---|---|
| Video stays private until Talkinu approval | Aparat links are public as soon as the applicant publishes and submits them |
| Processed duration is measured and 60–120s is enforced | Reviewers glance at duration; Talkinu cannot measure it |
| Talkinu can revoke public playback | Talkinu cannot revoke or delete the underlying Aparat video |
| Direct upload, webhooks, and provider reconciliation | Dropped entirely. No Mux credentials, webhooks, or jobs remain |

60–120 seconds remains product guidance for applicants and reviewers. It is
not a technical gate.

## Environment

No Mux secrets are required. Do not reintroduce `MUX_*` variables.

Aparat embed playback needs `https://www.aparat.com` in the production
report-only CSP `frame-src`.
