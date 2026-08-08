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
2. Upload a valid introduction video.
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

## Teacher introduction video

Purpose:

Help students understand the teacher's personality, communication style, spoken English, and teaching approach.

Requirements:

- 60–120 seconds
- one active introduction-video record per teacher profile
- processed duration is validated server-side
- must pass review before becoming publicly usable
- replacement may require a new review

Video bytes are not stored in PostgreSQL.

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