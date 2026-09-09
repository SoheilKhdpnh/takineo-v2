# Takineo Booking Domain Contract

Status: Wave 2 architecture contract
Scope: Iran-first teacher marketplace and 15-minute speaking-session booking

## 1. Product invariant

Every Takineo speaking booking represents exactly one 15-minute conversation between one eligible student and one eligible teacher.

Booking correctness must not depend on frontend state.

The database and service layer remain authoritative.

---

## 2. Initial market and time model

Takineo launches for users in Iran.

The product therefore uses Asia/Tehran as its canonical operational timezone for availability and booking presentation.

Wave 2 does not expose timezone configuration in booking UX.

Recurring teacher availability is represented as Tehran local wall-clock time.

Actual SpeakingSession timestamps represent absolute instants.

This keeps the initial implementation simple while preserving a future path to international scheduling.

International multi-timezone scheduling is explicitly outside Wave 2.

---

## 3. Session duration

Speaking sessions are exactly 15 minutes.

A session start must align to a 15-minute boundary.

Examples:

Valid:
09:00
09:15
09:30
09:45

Invalid:
09:05
09:20
09:37

Session duration is not supplied by the client.

The server derives:

endAt = startAt + 15 minutes

---

## 4. Teacher availability

Teacher availability is recurring weekly availability.

A teacher may define multiple availability windows on the same weekday.

Example:

Saturday:
09:00–12:00
17:00–20:00

Monday:
14:00–18:00

Availability rules are not individual bookable slots.

Slots are projected from availability rules when availability is queried.

This avoids materializing large numbers of future rows.

---

## 5. Availability rule invariants

Each TeacherAvailabilityRule belongs to exactly one teacher profile.

A rule contains:

- weekday
- start minute of day
- end minute of day
- active state
- created/updated timestamps

Minute-of-day values are based on Tehran local time.

Examples:

09:00 = 540
09:15 = 555
18:30 = 1110

Rules must satisfy:

- startMinute >= 0
- endMinute <= 1440
- startMinute < endMinute
- both boundaries align to 15 minutes
- window length is at least 15 minutes

Overlapping active windows for the same teacher should be rejected.

---

## 6. Availability exceptions

TeacherAvailabilityException represents a date-specific deviation from recurring availability.

Wave 2 supports:

UNAVAILABLE
AVAILABLE

UNAVAILABLE removes time from recurring availability.

AVAILABLE permits a teacher to add availability on a date even if no recurring rule normally covers that period.

An exception contains:

- teacher profile
- Tehran-local calendar date
- start minute
- end minute
- type
- optional teacher note
- created/updated timestamps

Exceptions also use 15-minute-aligned boundaries.

---

## 7. Availability changes and existing bookings

Changing or deleting availability must never silently change an existing SpeakingSession.

Availability describes what may be booked in the future.

SpeakingSession represents an accepted historical commitment.

Therefore:

Teacher edits availability
→ existing sessions remain scheduled

If a booked session must be cancelled, cancellation occurs explicitly through the session lifecycle.

---

## 8. Slot projection

Available slots are calculated from:

active recurring availability
+
AVAILABLE exceptions
-
UNAVAILABLE exceptions
-
active existing sessions
-
past time
-
booking policy restrictions

The server is authoritative for slot projection.

The frontend may display projected availability but may never assume a displayed slot is still bookable.

Availability must be revalidated during booking.

---

## 9. SpeakingSession

SpeakingSession is the durable booking record.

It contains at minimum:

- id
- teacherProfileId
- studentUserId
- startAt
- endAt
- status
- booking idempotency key
- createdAt
- updatedAt

The teacher relationship uses TeacherProfile rather than only User because teacher eligibility and professional state belong to TeacherProfile.

The student relationship points to User unless a student-specific profile relationship is required by later domain logic.

---

## 10. Session status

Wave 2 begins with:

SCHEDULED
COMPLETED
CANCELLED

Cancellation metadata is modeled separately from payment state.

Future lifecycle additions such as NO_SHOW or IN_PROGRESS can be introduced without coupling them to payment or AI processing.

A session is never physically deleted as the normal cancellation mechanism.

---

## 11. Cancellation

Cancellation must preserve history.

Cancellation data includes:

- session
- actor user when applicable
- actor type
- optional reason
- cancelledAt

Actor type supports:

STUDENT
TEACHER
ADMIN
SYSTEM

Wave 2 may expose only student/teacher cancellation initially, but the data model must support administrative/system cancellation safely.

---

## 12. Booking eligibility

At booking time the student must:

- be authenticated
- have ACTIVE account status
- satisfy student booking authorization
- not be booking their own teacher identity

At booking time the teacher must:

- have ACTIVE account status
- have an APPROVED teacher application
- have a complete teacher profile
- have an APPROVED valid introduction video
- satisfy existing public-teacher eligibility rules

Eligibility is checked server-side during the booking transaction.

A previously rendered teacher page does not constitute authorization.

---

## 13. Double-booking protection

Application-level pre-checks are not sufficient.

PostgreSQL must enforce active-booking collision protection.

For 15-minute aligned sessions:

one teacher may have at most one active session for a given startAt.

A student may also have at most one active session for a given startAt.

Cancelled sessions must not permanently block rebooking of the same slot.

This likely requires partial unique indexes over active session states.

If Prisma cannot express the required partial indexes directly, they will be created explicitly in the SQL migration.

---

## 14. Idempotency

Booking requests must be retry-safe.

Network failure may occur after PostgreSQL commits but before the client receives the response.

Therefore the client/request supplies an idempotency key.

The database stores the key with the resulting SpeakingSession.

Repeating the same booking request must return the same successful booking rather than create another session.

Idempotency enforcement must exist at database level.

---

## 15. Transaction boundary

Creating a booking is a transactional domain operation.

The transaction must:

1. authenticate/resolve student before entering the service
2. validate structural request data
3. load authoritative teacher state
4. verify teacher eligibility
5. verify requested time
6. verify recurring availability
7. apply date exceptions
8. verify policy limits
9. create the session under DB collision constraints
10. commit

Race conditions are resolved by the database.

A preflight "slot available" response is never a reservation.

---

## 16. Concurrency

Wave 2 integration tests must prove at minimum:

- two students cannot obtain the same teacher slot
- one student cannot obtain conflicting same-time sessions
- a cancelled slot can become bookable again
- availability editing does not mutate an existing session
- retrying an idempotent booking does not duplicate it
- stale availability displayed in the UI cannot bypass transaction-time validation

These tests must run against real PostgreSQL.

---

## 17. Teacher availability editing

Teachers may only modify their own availability.

Availability writes require:

- authenticated teacher
- ACTIVE account
- teacher profile ownership
- valid application state as required by product policy
- origin protection for mutation routes
- schema validation

Ordinary route handlers must not use Prisma directly.

Expected architecture:

Route
→ authentication
→ authorization
→ trusted-origin protection
→ validation
→ service
→ Prisma/PostgreSQL

---

## 18. Booking policy

Product-specific policy values must be centralized rather than scattered through route/UI code.

Examples:

- minimum booking lead time
- maximum booking horizon
- student cancellation cutoff
- teacher cancellation policy
- maximum upcoming bookings per student

Wave 2 will define these values before booking endpoints are finalized.

---

## 19. Query performance

Availability projection must operate over a bounded date window.

The application must not generate unlimited future slots.

Database access should query only:

- relevant teacher rules
- exceptions within requested date range
- active sessions within requested date range

Required indexes will be designed around these access patterns.

---

## 20. Teacher discovery

Only publicly eligible teachers may appear in student discovery.

Teacher discovery and booking eligibility use the same central eligibility policy.

The listing layer must not recreate eligibility logic independently.

This prevents inconsistencies such as a teacher appearing bookable while the booking service considers them suspended.

---

## 21. Historical integrity

Session history is durable business data.

Later edits to:

- teacher availability
- teacher bio
- teacher timezone configuration
- student profile
- booking policies

must not alter historical session timestamps or lifecycle history.

---

## 22. Future boundaries

Wave 2 intentionally keeps these domains separate:

Payment
Classroom/video provider
Notifications
AI transcription
AI speaking analysis
Homework
Vocabulary extraction
Grammar history
Progress analytics

SpeakingSession will be the stable domain object these future systems reference.

They must not be embedded prematurely into the booking transaction.

---

## 23. International expansion boundary

Wave 2 is Iran-first.

No multi-timezone booking UI is required.

However:

- SpeakingSession uses absolute timestamps
- availability logic is isolated behind a service
- Tehran timezone assumptions are centralized
- presentation logic does not define database truth

This permits future introduction of teacher/user timezones without replacing the SpeakingSession domain.

---

## 24. UX principles

Booking must feel immediate and premium while remaining transactionally honest.

The UI must clearly distinguish:

available
selected
unavailable
booked
past
loading
booking in progress
booking succeeded
booking failed because another user took the slot

Optimistic UI must never falsely imply a booking succeeded before the server commits it.

Persian RTL and English LTR receive equal structural support.

Takineo booking UI should use the established Vazirmatn + Manrope typography system and a premium editorial visual language rather than generic scheduling-dashboard styling.

---

## 25. Definition of Wave 2 booking foundation complete

The booking foundation is complete only when:

- schema is reviewed
- migration is safe
- availability can be created and edited
- eligible teachers can be discovered
- availability can be projected
- students can book exactly 15-minute sessions
- double booking is impossible under concurrent PostgreSQL transactions
- cancellation preserves history
- booking retries are idempotent
- student upcoming/past sessions are accessible
- teacher upcoming/past sessions are accessible
- Persian/English booking UX is complete
- unit tests pass
- PostgreSQL integration tests pass
- Prisma validation passes
- lint passes
- typecheck passes
- production build passes
- Git review is clean
