# Vendor eligibility and export controls

Talkinu’s launch market is Iran. External vendor terms must be checked for
OFAC / restricted-country clauses **before** a provider is wired into
production. Late discovery is how Wave 3 lost time; the same question applies
to media providers.

## Mux — retired for teacher introduction video

**Evidence date:** 2026-09-18  
**Source:** [Mux Terms of Service](https://www.mux.com/terms) §13.7 Export
Controls

Mux requires customers to comply with U.S. export and import law and with
sanctions programs administered by OFAC. The customer represents and warrants
that they are not:

- designated on any list of prohibited or restricted parties, or
- located in, under the control of, or a national or resident of any
  restricted country, including those subject to an embargo.

That is the same restricted-country warranty pattern already found for
OpenAI, Anthropic, Twilio, and other U.S. vendors evaluated for this
project. Mux was not checked against that pattern before the original
direct-upload integration shipped.

Talkinu therefore cannot keep Mux as the teacher introduction-video
provider. The replacement is an Aparat URL submission flow. See
`docs/teacher-intro-video.md`.

This is a compliance retirement, not a simplification.
