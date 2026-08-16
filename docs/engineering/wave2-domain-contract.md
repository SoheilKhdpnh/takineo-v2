# Wave 2 Booking Domain Contract

**Owner:** Track A — Booking Core
**Canonical operational timezone:** `Asia/Tehran`
**Reconciled baseline:** `feat/wave2-booking-foundation` after Wave 1 integration (`28eef176d9b481e846ff4cabafe07b2274f9fe80`)
**Foundation migration under audit:** `prisma/migrations/20260810124000_add_booking_foundation/migration.sql`
**M1 status:** **CLOSED — contract documented, existing foundation reconciled against the integrated post-Wave-1 baseline, representative invariants green, real PostgreSQL constraints/concurrency verified, full quality gates green, and implementation reviewed against this contract.**

This file is the canonical Wave 2 booking contract. `docs/engineering/booking-domain.md` remains useful historical design material, but it does not by itself close M1.

## 1. Reconciliation disposition

The existing `feat/wave2-booking-foundation` implementation is valuable and should be preserved unless an executable invariant proves it wrong.

Keep, subject to green regression/invariant tests:

- the existing Prisma booking/availability models;
- `20260810124000_add_booking_foundation`;
- fixed 15-minute session duration and slot grid;
- PostgreSQL booking conflict constraints;
- recurring-availability overlap exclusion;
- booking idempotency;
- teacher/student advisory-lock coordination;
- serializable booking/cancellation transactions;
- cancellation history rows and `CANCELLED` slot release;
- `projectAvailabilityForDate`;
- single-teacher `getBookableSlotsForTeacher` for detail/read use;
- `isPublicTeacher` as the internal eligibility predicate.

Do **not** create a cosmetic replacement migration or rewrite these services solely to make them look newer.

Required reconciliation additions/hardening:

1. prove `+03:30` arithmetic against `Asia/Tehran` semantics and runtime-TZ independence;
2. lock exception precedence with an explicit overlap test;
3. prove read paths never auto-transition elapsed sessions to `COMPLETED`;
4. enforce an allowlisted public-teacher DTO boundary that cannot serialize application/admin-review fields;
5. add a batch-shaped discovery availability projection; never loop the single-teacher service;
6. retain deterministic ordering/pagination;
7. rerun real PostgreSQL constraint, integration, and concurrency tests after Wave 1 integration.

## 2. Database is the final conflict authority

Application checks and advisory locks improve diagnostics and coordination; they are not the final booking-conflict authority.

The PostgreSQL schema/migration must reject an illegal durable state even when:

- two application processes race;
- application-level prechecks are stale;
- an advisory lock is accidentally omitted by a future caller;
- two transactions attempt the same active teacher/student slot concurrently.

For the current Wave 2 model, speaking sessions are exactly 15 minutes and start on a 15-minute grid. Therefore an active-slot uniqueness rule by participant and `startAt` is equivalent to general interval overlap prevention for this fixed-duration model. If variable session durations are introduced later, this equivalence disappears and the database conflict primitive must be revisited (for example with a range exclusion constraint).

Known foundation conflict barriers include the active teacher slot, active student slot, and per-student booking idempotency key. Constraint identity, not brittle database message text, must drive deterministic application error mapping.

## 3. Half-open interval semantics

All booking and availability intervals use:

```text
[start, end)
```

Consequences:

- `18:00–18:15` and `18:15–18:30` are adjacent and legal.
- An availability window ending at 18:15 does not contain a slot starting at 18:15.
- Recurring-availability overlap checks must use half-open ranges.
- Exception subtraction and interval merging must preserve these semantics.

The existing recurring-availability exclusion constraint uses PostgreSQL `int4range(..., '[)')`; preserve that behavior.

## 4. Tehran civil-time semantics

### Semantic authority

The product scheduling timezone is **`Asia/Tehran`**, not "UTC+03:30" as a business rule.

All of the following are Tehran civil-time concepts:

- local booking date;
- weekday;
- minute-of-day;
- recurring availability;
- date-scoped exceptions;
- display/interpretation of scheduling dates.

Server/runtime local timezone must never decide those values. Scheduling code must not rely on environment-local `Date#getDay()`, `getHours()`, `getMinutes()`, or implicit local-date parsing.

### Fixed-offset audit

The current foundation declares:

```ts
BOOKING_OPERATIONAL_TIMEZONE = "Asia/Tehran"
BOOKING_IRAN_UTC_OFFSET_MINUTES = 210
```

and implements booking conversions by shifting instants by 210 minutes and then using UTC accessors.

As of this reconciliation, current IANA tzdb defines the Iran rules with no DST transitions after 2022 and `Asia/Tehran` continuing at `+03:30`. Within Takineo Wave 2's current/future booking horizon, the existing fixed-offset implementation is therefore behaviorally equivalent to current `Asia/Tehran` rules.

**Decision:** retain the implementation for Wave 2; do not rewrite it unnecessarily.

However:

- `Asia/Tehran` remains the semantic authority.
- `210` is an implementation optimization, not a permanent product invariant.
- tests must compare representative conversions to `Intl.DateTimeFormat(..., {timeZone: "Asia/Tehran"})`;
- tests must prove results are invariant when the Node/runtime `TZ` environment changes;
- any future internationalization, historical scheduling, horizon expansion, or Iran timezone-law/tzdb change triggers re-audit.

## 5. Availability model and precedence

Recurring availability and date exceptions compose as:

```text
final =
(recurring ∪ AVAILABLE exceptions)
− UNAVAILABLE exceptions
```

`UNAVAILABLE` wins every overlap conflict, including overlap with an `AVAILABLE` exception.

Implementation contract:

1. select active recurring intervals for the Tehran weekday;
2. select exceptions for the exact Tehran civil date;
3. merge recurring intervals with all `AVAILABLE` intervals;
4. subtract all `UNAVAILABLE` intervals;
5. project 15-minute slots from the resulting half-open windows;
6. remove occupied active session starts;
7. apply lead-time and booking-horizon bounds.

Availability exceptions are allowed to overlap because precedence is resolved by projection semantics. Do not add a database exclusion rule that makes the defined union/subtraction model impossible to express.

At minimum, executable tests must cover:

- recurring only;
- `AVAILABLE` expanding recurring availability;
- `UNAVAILABLE` removing recurring availability;
- `AVAILABLE` and `UNAVAILABLE` overlapping the same minutes, with `UNAVAILABLE` winning;
- adjacent exception windows;
- an exception crossing only part of a recurring window;
- fully blocked day;
- occupied slots;
- Tehran weekday/date boundary around UTC midnight.

## 6. Booking creation contract

A speaking-session booking mutation must enforce, server-side:

- authenticated actor;
- active account;
- student role/authorization for student booking;
- target teacher exists and is currently bookable;
- target teacher is publicly eligible under the internal eligibility predicate;
- start is a valid 15-minute grid instant;
- end is exactly 15 minutes after start;
- start is within lead-time and horizon policy;
- slot is inside final projected teacher availability;
- the student does not already own an active session at the same slot;
- the student has not exceeded the upcoming-session policy;
- idempotency rules are respected.

### Coordination and transaction ordering

The current foundation uses deterministic PostgreSQL transaction advisory locks for teacher and student booking scopes. Preserve the deterministic lock ordering to avoid lock-order deadlocks.

The mutation must perform authoritative checks and the insert in one serializable transaction. The database remains the final race barrier.

### Idempotency

Idempotency is scoped by `(studentUserId, bookingIdempotencyKey)`.

- same key + same logical request => return the existing session;
- same key + different teacher/start identity => deterministic idempotency conflict;
- a slot uniqueness collision without a matching idempotent session => deterministic slot-unavailable conflict.

Do not expose raw PostgreSQL error strings or constraint implementation details to clients.

## 7. Cancellation contract

Wave 2 supports cancellation plus an independent new booking. Dedicated atomic rescheduling is **out of scope**.

Cancellation rules:

- never physically delete the session;
- transition the session to `CANCELLED`;
- create/preserve one durable `SpeakingSessionCancellation` history record;
- cancellation authorization is server-side;
- student cancellation requires ownership;
- teacher cancellation requires ownership of the session's teacher profile;
- administrative cancellation requires the appropriate server-side capability;
- cancellation of a teacher's historical session must not depend on the teacher still being publicly bookable;
- cancellation must be serialized per session;
- replay after a successful cancellation must be deterministic/idempotent;
- `COMPLETED` is not cancellable;
- a cancelled session releases its active slot for an independent rebook while the cancelled row remains in history.

The current `onDelete: Restrict` relationships and one-to-one cancellation relation are aligned with this contract and should be preserved.

## 8. Session status and elapsed-time read model

Wave 2 must **never** mark a session `COMPLETED` solely because:

```text
endAt <= now
```

Elapsed time is a read-model fact, not a durable booking-state transition.

A Wave 2 session may therefore be persisted as `SCHEDULED` even after its scheduled end. Read models may expose a derived temporal classification such as past/elapsed/upcoming, but must preserve the persisted booking status.

Only Wave 3 live-session evidence may define and perform the durable transition to `COMPLETED`.

Required invariant test:

1. persist or mock a `SCHEDULED` session whose `endAt` is in the past;
2. call the session read service;
3. assert the returned persisted status is still `SCHEDULED`;
4. assert no Prisma `update`/`updateMany`/raw mutation was invoked;
5. if a derived elapsed flag/classification exists, assert it is read-only.

## 9. Teacher eligibility and privacy boundary

Bookability/discovery eligibility currently requires the internal equivalent of:

- user account `ACTIVE`;
- teacher application `APPROVED`;
- teacher profile completed;
- introduction video `APPROVED`.

This eligibility information may be queried internally to decide whether a teacher can be returned or booked.

It must **not** leak through public teacher representations.

Public/discovery DTOs must use positive allowlists. They must not serialize admin/application-review state such as:

- `applicationStatus`;
- application submitted/reviewed timestamps;
- `applicationReviewNote`;
- review cycle/revision snapshot metadata;
- submitted video IDs/revisions/upload IDs/asset IDs;
- legacy trust/review fields;
- admin audit/capability data;
- provider-private review playback identifiers.

This is primarily a domain/API/privacy boundary. Do **not** introduce a new physical `TeacherApplication` table merely because the public teacher concept and application-review concept are separate domains.

The Wave 1 schema can remain physically consolidated in `TeacherProfile` while services/DTOs enforce the separation.

## 10. Discovery next-available projection

`getBookableSlotsForTeacher()` is single-teacher shaped and is valid for a teacher detail/read path.

Discovery must **not** call it once per teacher.

Add a separate batch projection path with a bounded set of candidate teacher profile IDs and a bounded date horizon. The database access shape must be constant/batch-oriented, for example:

1. one eligibility/public-teacher query (or consume an already-batched eligible candidate list);
2. one `findMany` for recurring rules across all candidate IDs;
3. one `findMany` for exceptions across all candidate IDs/date range;
4. one `findMany` for active sessions across all candidate IDs/time range;
5. group rows in memory by teacher/date;
6. reuse the pure projection function;
7. return `Map<teacherProfileId, nextAvailableAt | null>` or an equivalent batch result.

The implementation must have an executable query-count/spy test demonstrating that query count does not grow linearly with teacher count.

Only approved/bookable teachers may receive a non-public discovery representation or accept a booking.

## 11. Deterministic ordering and pagination

Every paginated or ordered Wave 2 read must have a total deterministic order.

Rules:

- preserve the product's chosen primary ordering;
- append a stable unique tie-breaker such as `id`;
- cursor pagination must encode/compare the complete ordering tuple when the primary key alone cannot preserve the ordering;
- next-available results with equal timestamps must use a deterministic teacher ID tie-breaker;
- never depend on incidental PostgreSQL row order.

This contract does not invent a new discovery ranking. It constrains whatever product ranking Track B/Discovery uses to be deterministic.

## 12. Deterministic mutation errors

Domain errors must remain stable under concurrency and database races.

Known booking-domain errors include the existing `BookingSlotUnavailableError` and `BookingIdempotencyConflictError`. Preserve existing production-grade error classes where they already express the contract.

Database uniqueness/exclusion violations must be classified by known constraint/index identity or an equally deterministic mechanism, never by free-form message substring matching.

Authorization failures, not-found behavior, cancellation-state conflicts, idempotency conflicts, slot conflicts, and validation failures must not collapse into one ambiguous generic conflict.

Raw provider/database details, SQL, private IDs, or review metadata must not be exposed through public errors.

## 13. Executable invariant matrix

The existing foundation already contains meaningful unit/integration coverage. Reconcile and extend rather than replace it.

| Invariant | Expected evidence |
|---|---|
| exact 15-minute session | migration check + DB integration test |
| 15-minute start grid | migration check + DB integration test |
| teacher active-slot conflict | DB constraint + concurrent integration test |
| student active-slot conflict | DB constraint + concurrent integration test |
| adjacent slots legal | DB/integration test |
| cancelled slot releases while history remains | integration test |
| idempotent retry returns same session | service/integration test |
| same key, different request conflicts | service/integration test |
| recurring availability cannot overlap | GiST exclusion + integration test |
| recurring adjacency legal | DB integration test |
| exception precedence | **explicit unit test required** |
| runtime TZ cannot alter Tehran weekday/minute | **explicit unit/process test required** |
| fixed-offset helper equals current `Asia/Tehran` | **explicit IANA/Intl equivalence test required** |
| elapsed session is not auto-completed | **explicit read-service non-mutation test required** |
| cancellation authorization/history | existing unit/integration tests + regression rerun |
| public teacher DTO excludes review/admin fields | **explicit serialization test required** |
| discovery next-available is batch-shaped | **new service + query-count test required** |
| booking concurrency deterministic | existing DB/service concurrency coverage + regression rerun |
| deterministic pagination/order | discovery/read tests with tie cases |

## 14. M2/M3 implementation sequence

### M2 — reconcile foundation and harden executable contract

1. Keep the existing booking migration unless a failing invariant proves a schema gap.
2. Add Tehran equivalence/runtime-TZ tests.
3. Add explicit `UNAVAILABLE`-wins-overlap projection test.
4. Add/strengthen DB constraint and concurrency tests after Wave 1 integration.
5. Add elapsed-read non-mutation test.
6. Review public teacher selects/DTOs and add leak-prevention test.
7. Run Prisma generation/validation and the focused unit/integration suite.
8. Review implementation against this contract.

If no schema defect is discovered, **do not create a no-op migration merely to say M2 happened**. The already-real foundation migration is the M2 schema implementation being reconciled against the integrated baseline.

### M3 — discovery/session read completion

1. Add batch discovery next-availability projection.
2. Reuse pure availability projection logic.
3. Add bounded query-count test and multi-teacher correctness tests.
4. Add deterministic ordering/tie tests.
5. Verify only bookable teachers are returned.
6. Verify public DTO allowlists.
7. Rerun booking/cancellation/concurrency regression tests.

No booking UI is part of Track A.

## 15. M1 closure gate

M1 is stable enough for downstream Track B only when **all** of these are true on the integrated post-Wave-1 checkout:

- [x] canonical contract documented here;
- [x] a real booking schema/domain implementation exists and has exercised the contract (`20260810124000_add_booking_foundation` plus booking services);
- [x] migration applies cleanly to an isolated PostgreSQL test database from the integrated baseline;
- [x] Prisma generate/validate are green;
- [x] representative availability, booking, idempotency, cancellation, DB-constraint, and concurrency tests are green;
- [x] explicit `UNAVAILABLE` precedence test is green;
- [x] Tehran `Asia/Tehran` equivalence and runtime-TZ independence tests are green;
- [x] elapsed-session non-auto-completion test is green;
- [x] public teacher privacy/DTO leak test is green;
- [x] implementation reviewed line-by-line against this contract;
- [x] any discovered deviations are fixed or explicitly recorded as accepted contract changes.

All M1 closure-gate items above have now been proven on the integrated post-Wave-1 checkout. Track A Wave 2 M1 is closed and the Track B entry gate is open. M3 batch discovery / next-available projection remains subsequent Track A work.

## 16. Prisma ownership and downstream communication

While Track A is active, Track A owns booking-related Prisma schema and migration changes.

For every schema-affecting Track A merge, downstream tracks must immediately:

```powershell
npm run db:generate
npm run db:validate
```

and then rerun their typecheck/tests.

The Track A merge note must explicitly say whether the merge is:

```text
PRISMA SCHEMA-AFFECTING: YES
```

or:

```text
PRISMA SCHEMA-AFFECTING: NO
```

For this documentation-only reconciliation artifact: **NO**.

Generated Prisma output is never a substitute for applying/reviewing the canonical schema/migration, and stale generated types must not be trusted across worktrees.

## 17. Out of scope for Wave 2 Track A

- booking UI;
- dedicated atomic rescheduling;
- automatic elapsed-time `COMPLETED` transitions;
- Wave 3 live-session completion evidence;
- international/multi-timezone scheduling behavior beyond keeping the model extensible;
- physical `TeacherApplication` table split solely for naming/domain purity.
