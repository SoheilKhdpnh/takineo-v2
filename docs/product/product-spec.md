# Takineo Product Specification

## Product vision

Takineo is an AI-assisted English-learning ecosystem centered on real human speaking practice.

Core principle:

> Teachers teach. AI analyzes. Students improve.

Human teachers remain central to instruction.

AI acts as a professional assistant for analysis, personalization, feedback, and learning continuity.

## Initial market

Takineo initially targets users in Iran.

Product requirements therefore include:

- Persian-first interface
- English secondary interface
- RTL support
- localized validation and messaging
- timezone-aware scheduling
- reliable behavior on weaker or unstable connections

## Core learning unit

The central Takineo product is an exactly 15-minute speaking session between a student and a human teacher.

The long-term core flow is:

1. Student discovers an approved teacher.
2. Student chooses an available time.
3. Student books a 15-minute speaking session.
4. Student and teacher join the speaking session.
5. Conversation is captured/transcribed.
6. AI analyzes the session.
7. Teacher reviews the AI analysis.
8. Teacher edits or adds feedback.
9. Student receives a personalized report.
10. Homework is generated.
11. Useful vocabulary is extracted.
12. Grammar errors are stored.
13. Progress evolves across sessions.

## AI analysis dimensions

Initial core analysis dimensions:

- Grammar
- Vocabulary
- Fluency
- Pronunciation

AI-generated feedback must remain reviewable by the teacher when used as instructional feedback.

## Roles

### Student

A student can eventually:

- maintain a learner profile
- discover approved teachers
- watch teacher introduction videos
- inspect teacher availability
- book sessions
- join speaking sessions
- receive teacher-reviewed reports
- receive homework
- review vocabulary and grammar history
- track progress

### Teacher applicant

Selecting the teacher onboarding option means:

`Apply to teach`

It does not automatically create a public teacher.

An applicant must:

1. Complete a professional teacher profile.
2. Record an introduction on Aparat, say the Talkinu verification phrase plus the assigned code, and submit the public Aparat link.
3. Submit the application.
4. Pass administrative review.

### Approved teacher

An approved teacher may eventually:

- appear in teacher discovery
- publish availability
- receive bookings
- conduct speaking sessions
- review AI analysis
- provide final student feedback

### Administrator

Administrators are trusted Takineo operators.

They will eventually manage:

- teacher applications
- teacher video review
- approval and rejection
- suspension
- operational support
- moderation
- selected system configuration
- audit/review workflows

Administrative capabilities must never be self-assignable.

Administrative access remains separate from the student/teacher product role.
Wave 1 permission levels are `REVIEWER` and `SUPER_ADMIN` and are provisioned
only through server-controlled workflows.

## Account activity

Server-controlled account states are:

- `ACTIVE`
- `SUSPENDED`
- `DISABLED`

Account-level suspension is distinct from teacher-specific application
suspension. A public teacher must have an `ACTIVE` account.

## Teacher application lifecycle

States:

`DRAFT`

Applicant can edit profile and video.

`PENDING_REVIEW`

Application has been submitted.
Profile/video become locked during review.

`APPROVED`

Teacher has passed Takineo review.

`REJECTED`

Applicant may make required changes and resubmit.

`SUSPENDED`

Existing teacher access/public visibility is restricted by Takineo.

Suspension and reinstatement use a privacy-preserving applicant-feedback
policy. The exact administrator-entered moderation reason remains internal
and auditable. A suspended teacher sees a localized generic status explanation
and support path. After reinstatement the teacher sees the ordinary `APPROVED`
active state; Takineo does not expose the internal reinstatement reason or
moderation history in the teacher product. Exact review notes remain
applicant-facing only for `REJECTED` application review.

Profile and introduction-video review decisions are logically separate. Final
application approval requires both to be acceptable, and the current video must
be `APPROVED`. Profile-only rejection preserves an already approved unchanged
video; video rejection requires replacement and review.

## Teacher introduction video

Purpose:

Help students understand the teacher's personality, communication style, spoken English, and teaching approach.

Requirements:

- 60–120 seconds is product guidance for applicants and reviewers, not a technical gate
- one active introduction-video record per teacher profile
- the applicant submits a validated `aparat.com` URL, not an uploaded file
- a short verification code is generated for the application; the applicant must say “This video is recorded for the Talkinu team” plus that code
- must pass review before the teacher can appear on Talkinu
- replacement may require a new review
- review uses Aparat’s public embed; Talkinu does not host or revoke the underlying video
- approval controls Talkinu visibility only

Video bytes are not stored in PostgreSQL. Aparat links are public on submission.

Mux was retired after Terms §13.7 matched the same OFAC restricted-country warranty already found for other U.S. vendors. See `docs/engineering/vendor-eligibility.md` and `docs/teacher-intro-video.md`.

The binding Wave 1 review behavior is defined in
[`admin-review-contract.md`](../engineering/admin-review-contract.md).

## Localization

Supported launch locales:

- `fa`
- `en`

Persian is the default.

All public product flows must work correctly in RTL and LTR modes.

## Product quality principles

Takineo should feel:

- calm
- premium
- clear
- trustworthy
- human
- focused

Avoid unnecessarily complex dashboards or enterprise-style visual clutter.

The interface should prioritize the next useful action for the user.

## Current completed foundation

The repository currently contains foundational implementations for:

- authentication
- protected sessions
- role onboarding
- Persian/English localization
- RTL/LTR
- student profile
- teacher profile
- teacher application status foundation
- teacher introduction-video upload foundation
- resilient video processing synchronization
- secure teacher application submission

## Current major missing systems

Major product systems still to build include:

- administrative teacher review
- teacher availability
- teacher discovery
- booking
- scheduling conflict protection
- speaking-room/session infrastructure
- transcription
- AI analysis
- teacher feedback review
- student learning reports
- homework
- progress tracking
- notifications
- production hardening
