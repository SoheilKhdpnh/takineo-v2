# Wave 3 Live Speaking Session Contract

**Owner:** Wave 3 — Live Speaking (`feat/wave3-live-speaking`)
**Canonical operational timezone:** `Asia/Tehran`
**Reconciled baseline:** `integration/wave2-final` (`12ebf3ad`)
**Upstream handoff:** `docs/engineering/wave2-domain-contract.md` §8, §17
**M1-A status:** **CLOSED — join authorization, provider identity boundary, and evidence reduction are frozen as pure domain rules with executable invariants.**
**M1-B status:** **CLOSED — `REJOIN_GRACE` and `EVIDENCE_HORIZON_GRACE` are frozen as two independent policies. Their production values remain deliberately unfrozen.**
**M1-C status:** **CLOSED — join-window derivation consumes `REJOIN_GRACE`, and the evidence-based completion decision is defined as a pure rule separate from any write.**
**M2 status:** **CLOSED — additive grant and event persistence, with executable database invariants.**
**M3 status:** **CLOSED — services and transport against a fake provider adapter. Production grace values and vendor selection remain unfrozen.**

This file is the canonical Wave 3 contract. It records decisions that are already
frozen in `lib/domain/live-session/**` and constrains the persistence, service,
and transport work that follows.

## 0. Wave numbering reconciliation

`docs/agents/roadmap.md` originally numbered live speaking as Wave 4, because it
listed Teacher Discovery as Wave 3. Discovery was delivered inside Wave 2 as
Track B, which collapsed the numbering by one.

The operative name for live speaking work is **Wave 3**. This is not a
renumbering decision made here; it is already binding upstream:

- `docs/engineering/wave2-domain-contract.md` §8 — "Only Wave 3 live-session
  evidence may define and perform the durable transition to `COMPLETED`";
- `docs/engineering/wave2-domain-contract.md` §17 — out of scope: "Wave 3
  live-session completion evidence";
- committed suites named `Wave 3 live-session policy`, `Wave 3 live-session
  provider contract`, and `Wave 3 live-session evidence reducer`.

Do not renumber the roadmap's earlier waves to compensate. The roadmap carries a
reconciliation note instead.

## 1. Upstream ownership boundary

Wave 2 Track A is **stable-for-handoff, not formally closed**. Its contract
declares only `M1 status: CLOSED`, and §16 states that Track A owns
booking-related Prisma schema and migration changes "while Track A is active".
That active status has never been formally terminated, and §15 records that M3
"remains subsequent Track A work".

Therefore Wave 3 **consumes** the booking model and does not redefine it.

Wave 3 must not:

- add, remove, rename, or retype any existing `SpeakingSession` column;
- extend, reorder, or reinterpret `SpeakingSessionStatus`;
- alter the booking state machine, its transitions, or its authorization rules;
- alter `SpeakingSessionCancellation`, availability models, or discovery models;
- weaken or replace any existing booking constraint, exclusion constraint, or
  partial unique index;
- rewrite `lib/domain/booking*.ts`, `lib/services/booking*.ts`,
  `lib/services/session-cancellation.service.ts`, or
  `lib/services/speaking-session-read.service.ts`.

Wave 3 **owns**, as an additive-only surface:

- `SpeakingSessionLiveGrant`;
- `SpeakingSessionLiveEvent`;
- enums and relations introduced solely for those two models;
- `lib/domain/live-session/**`;
- live-session services, validations, errors, and routes added by this wave.

Any need to change a Wave 2-owned column or transition is a contract change that
must be escalated to the integration lead before implementation, not resolved
inside a Wave 3 migration.

## 2. Session status authority

Wave 2 §8 forbids marking a session `COMPLETED` merely because `endAt <= now`.
Elapsed time is a read-model fact.

Wave 3 is the only wave permitted to define and perform the durable transition
to `COMPLETED`, and it may do so **only** from live-session evidence.

Consequences:

- a persisted `SCHEDULED` session whose `endAt` is in the past remains
  `SCHEDULED` until Wave 3 evidence justifies completion;
- evidence reduction itself is pure and must never write;
- the durable transition is a separate, explicitly authorized service effect;
- `CANCELLED` is terminal with respect to completion.

Evidence reduction and status transition are deliberately separate concerns. Do
not fuse them into one function.

### Completion decision

The decision is a pure rule over a session snapshot, a reduction, and an explicit
`asOf`. It decides; it never writes.

Blocked reasons are evaluated in exactly this order:

1. `ALREADY_COMPLETED` — persisted status is already `COMPLETED`, so a replayed
   decision is idempotent rather than an error;
2. `SESSION_CANCELLED` — `CANCELLED` is terminal and is never completed, even
   with full attendance evidence;
3. `EVIDENCE_NOT_FINAL` — `asOf < analyticalHorizonAt`, so further authentic
   evidence can still be attributed;
4. `EVIDENCE_UNRELIABLE` — any participant reduced to `INVALID_SEQUENCE`;
5. `NO_PARTICIPANT_PRESENCE` — nobody accumulated presence;
6. `INCOMPLETE_PARTICIPATION` — only one side attended.

Terminal status is checked before evidence finality so a cancelled session
produces a stable reason regardless of when the decision runs.

`ROOM_ENDED` alone does **not** make evidence final. It bounds presence, but late
authentic disconnect evidence may still arrive and change quality, so finality is
governed only by `analyticalHorizonAt`.

A completable decision reports the evidence-bounded `effectiveAt` plus student
and teacher presence. `effectiveAt` is **not** persisted on `SpeakingSession`,
which has no column for it and must not gain one under §1. Persisting it requires
a Wave 3-owned table.

### Open product decision

A session where only one side attended is a no-show outcome.
`SpeakingSessionStatus` is Wave 2-owned and has no no-show member, so Wave 3
reports `INCOMPLETE_PARTICIPATION` rather than inventing a durable state.

How no-shows are settled as a product concern — and whether that requires a
Wave 2-owned status change — is **unresolved** and must be escalated to the
integration lead rather than decided inside Wave 3.

## 3. Timing policy

M1-B freezes two **independent** policies:

```text
REJOIN_GRACE
EVIDENCE_HORIZON_GRACE
```

Rules:

- they are separate concepts and must never be collapsed into one value;
- `EVIDENCE_HORIZON_GRACE` extends the analytical horizon past `endAt` so late
  authentic provider evidence can still be attributed;
- `REJOIN_GRACE` belongs to the join/authorization side and must not influence
  evidence-horizon computation or reconnect counting;
- both are non-negative safe integers in milliseconds;
- **production values are deliberately not frozen.** Callers must supply both
  explicitly. Do not invent defaults in domain, service, or route code.

The independence of `REJOIN_GRACE` from reduction is an executable invariant,
not a stylistic preference. It is proven in both directions: changing
`REJOIN_GRACE` must not move `analyticalHorizonAt`, and changing
`EVIDENCE_HORIZON_GRACE` must not move the join window.

## 4. Join authorization

Join authorization is a pure decision over a session snapshot, an actor
snapshot, an explicit join window, and an explicit `asOf`.

The join window uses the same half-open convention Wave 2 locked in:

```text
[opensAt, closesAt)
```

`asOf == closesAt` is closed, not open.

### Window derivation

The window is derived from the booked schedule and frozen policy only:

```text
opensAt  = session.startAt
closesAt = session.endAt + REJOIN_GRACE
```

This is the sole consumer of `REJOIN_GRACE`, which is what makes it a join-side
concept rather than an unused value.

There is deliberately **no early-join allowance**. No early-join policy has been
frozen, and choosing one would be a product decision rather than a derivation.
Adding an early-join grace later is an additive policy change and must be frozen
in this contract before implementation.

`EVIDENCE_HORIZON_GRACE` must never widen the window. Evidence attribution and
join authorization are separate boundaries.

### Frozen denial precedence

Denial reasons are evaluated in exactly this order:

1. `NOT_PARTICIPANT` — actor matches neither the session's student nor its
   teacher;
2. `ACCOUNT_INACTIVE` — actor is a participant but not active;
3. `SESSION_NOT_JOINABLE` — persisted status is not `SCHEDULED`;
4. `JOIN_WINDOW_NOT_OPEN` — `asOf < opensAt`;
5. `JOIN_WINDOW_CLOSED` — `asOf >= closesAt`.

Participant resolution precedes the active-account check deliberately, so a
non-participant never learns anything about the session's state.

Denials are typed values, never booleans and never thrown exceptions.

### Structural violations

These are programmer errors, not denials, and raise `RangeError`:

- an invalid `Date` in any input;
- `session.endAt <= session.startAt`;
- `joinWindow.closesAt <= joinWindow.opensAt`;
- `session.studentUserId === session.teacherUserId`.

Frontend visibility is not authorization. A route must call this predicate
server-side even when the UI already hid the join affordance.

## 5. Provider identity boundary

Four identities are distinct and must never be conflated:

| Identity | Scope | Meaning |
|---|---|---|
| `participantUserId` | Takineo | the authenticated user |
| `clientJoinAttemptId` | client-supplied | idempotency key for one join attempt |
| `grantId` | Takineo | one credential-issuance authorization |
| `providerParticipantRef` | provider | opaque provider identity for exactly one grant |

Rules:

- `providerParticipantRef` belongs to exactly one grant and is never reused
  across grants;
- `providerParticipantRef` is never a Takineo user identifier and never a
  session-wide participant identifier;
- `clientJoinAttemptId` is idempotent per `(participantUserId,
  clientJoinAttemptId)`; a replayed attempt must not mint a second grant;
- a grant carries **no** expiry. Expiry belongs to the issued credential.

### Issuance, expiration, and revocation

One grant represents one credential-issuance attempt. Issuance is a provider
effect distinct from grant authorization.

- `issueCredential` returns an opaque credential plus `expiresAt`;
- natural expiration is **not** an explicit revocation effect;
- `revokeCredential` is the only explicit revocation effect;
- provider credentials must never be logged, persisted in plaintext beyond
  operational need, or returned to a client that did not authorize the grant;
- provider secrets remain server-only.

## 6. Provider evidence events

Three event types are recognized:

| Type | Scope | Carries |
|---|---|---|
| `PARTICIPANT_CONNECTED` | connection | `providerParticipantRef`, `connectionRef` |
| `PARTICIPANT_DISCONNECTED` | connection | `providerParticipantRef`, `connectionRef` |
| `ROOM_ENDED` | room | neither |

Rules:

- `providerEventRef` is the deduplication key;
- `connectionRef` distinguishes simultaneous connections under one
  `providerParticipantRef`;
- `ROOM_ENDED` is room-scoped and must never fabricate participant presence or
  participant disconnect evidence;
- events belonging to another session are ignored;
- events with `occurredAt > asOf` are ignored.

### Duplicate and conflicting delivery

- an exact retry of the same `providerEventRef` with an identical signature is
  deduplicated silently;
- the same `providerEventRef` reused with a **different** signature is
  **excluded entirely** and counted in `conflictingProviderEventRefCount`. The
  reducer must never arbitrarily pick one payload;
- a participant event whose `providerParticipantRef` matches no grant is counted
  in `unattributedParticipantEventCount` and attributed to nobody.

Webhook ingestion must be idempotent and signature-verified, consistent with
`docs/engineering/security.md`.

## 7. Evidence reduction

Reduction is a **pure** function. It takes an explicit `asOf` and must never read
`Date.now()`, never mutate its inputs, and never perform I/O.

### Horizons

```text
analyticalHorizonAt  = session.endAt + EVIDENCE_HORIZON_GRACE
liveEvidenceHorizonAt = min(asOf, analyticalHorizonAt, roomEndedAt ?? +infinity)
```

`roomEndedAt` is the **earliest** accepted `ROOM_ENDED` occurrence, or `null`.

### Interval construction

Per connection group, keyed by `(providerParticipantRef, connectionRef)`:

- interval start is clamped up to `session.startAt`;
- interval end is clamped down to `liveEvidenceHorizonAt`;
- a non-positive interval contributes nothing;
- an interval ending at the horizon without a disconnect is `OPEN_AT_HORIZON`;
- `intervalEndReason` is `PARTICIPANT_DISCONNECTED`, or `ROOM_ENDED` when the
  horizon is exactly the room-ended instant, otherwise `ANALYTICAL_HORIZON`.

An open connection is bounded analytically. The reducer must **never** fabricate
a disconnect event to close it.

### Sequence classification

| Connection group shape | Effect |
|---|---|
| no `CONNECTED`, one or more `DISCONNECTED` | `orphanDisconnectCount += n` |
| more than one `CONNECTED`, or more than one `DISCONNECTED` | `invalidSequenceCount += 1` |
| `DISCONNECTED` earlier than `CONNECTED` | `invalidSequenceCount += 1` |
| `CONNECTED` with no `DISCONNECTED` before the horizon | `openConnectionCount += 1` |

An orphan disconnect contributes zero presence and is **not** an invalid
sequence. It self-corrects if delayed authentic `CONNECTED` evidence arrives, and
late authentic disconnect evidence may upgrade quality after `ROOM_ENDED`.

### Presence and reconnects

Presence is the **union** of a participant's intervals:

- simultaneous connections must not double-count presence;
- `reconnectCount` counts later aggregate zero-to-one presence transitions, so
  overlapping connections do not inflate it;
- a participant with a grant but no events yields zero presence and still
  appears in the reduction.

### Quality precedence

```text
INVALID_SEQUENCE > ORPHANED_DISCONNECT > OPEN_AT_HORIZON > COMPLETE
```

### Determinism

- provider events sort by `occurredAt`, then type order
  (`CONNECTED`, `DISCONNECTED`, `ROOM_ENDED`), then `providerEventRef`;
- intervals sort by `startedAt`, `endedAt`, `providerParticipantRef`,
  `connectionRef`;
- participants sort `STUDENT` before `TEACHER`, then by `participantUserId`;
- input arrays are left in the order supplied.

### Grant validation

Reduction raises `RangeError` when:

- a grant does not belong to the reduced session;
- `grantId` is not unique;
- `providerParticipantRef` is not unique per grant;
- `(participantUserId, clientJoinAttemptId)` is not idempotent;
- one participant appears with more than one role.

## 8. Additive persistence surface

Wave 3 introduces exactly two tables plus enums and relations that exist only to
serve them. The models persist the already-frozen domain types; they do not
introduce new domain concepts.

`SpeakingSessionLiveGrant` persists `LiveSessionCredentialGrant`:

- references `SpeakingSession` with `onDelete: Restrict`, consistent with the
  booking model's existing restrict-based history preservation;
- unique on `providerParticipantRef`, enforcing §5's one-ref-per-grant rule at
  the database level;
- unique on `(participantUserId, clientJoinAttemptId)`, enforcing join-attempt
  idempotency at the database level;
- carries no credential material and no grant-level expiry.

`SpeakingSessionLiveEvent` persists `LiveSessionProviderEvidenceEvent`:

- unique on `providerEventRef`, making duplicate webhook delivery a database-level
  no-op rather than an application-level guess;
- participant fields are nullable because `ROOM_ENDED` is room-scoped, and a
  CHECK constraint must enforce that participant event types carry both
  `providerParticipantRef` and `connectionRef` while `ROOM_ENDED` carries
  neither;
- stores raw provider evidence, never derived presence.

Derived presence is not persisted by these two models. Reduction stays a pure
read-time computation until a separate, explicitly authorized transition records
completion.

The database is the final authority for grant and event uniqueness. Application
checks improve diagnostics; they are not the barrier.

Constraint identity, not database message text, must drive error mapping.

### 8.1 Declarative reach of the Prisma schema

The Prisma schema can express the two unique keys on the grant table, the unique
key on the event table, and the restrict-based foreign keys. It cannot express a
CHECK constraint at all.

Therefore the participant-field shape rule is hand-written SQL in the migration,
not a schema-derived artifact:

- `ss_live_event_participant_shape_check` enforces that
  `PARTICIPANT_CONNECTED` and `PARTICIPANT_DISCONNECTED` carry a non-blank
  `providerParticipantRef` and a non-blank `connectionRef`, while `ROOM_ENDED`
  carries neither.

Because it is hand-written, `prisma migrate diff` against the applied database
will not report its absence as drift. A regression that silently drops it is only
detectable by a test that asserts the constraint rejects a malformed row, so
§9 carries that assertion as an executable invariant rather than a review note.

The same reasoning applies to the non-blank reference checks
`ss_live_grant_join_attempt_format_check`,
`ss_live_grant_provider_participant_format_check`, and
`ss_live_event_provider_event_format_check`. Prisma's `@db.VarChar` bounds length
only; it cannot reject an empty or untrimmed reference.

The canonical constraint names above are the stable identifiers that error
mapping keys on.

## 9. Executable invariant matrix

| Invariant | Expected evidence | Status |
|---|---|---|
| join window is half-open | unit test | green |
| frozen denial precedence | unit test per reason | green |
| structural violations raise | unit test | green |
| `REJOIN_GRACE` independent of horizon and reconnects | explicit unit test | green |
| grace policies rejected when negative or unsafe | unit test | green |
| four identities stay distinct | unit test | green |
| grant carries no expiry | unit test | green |
| expiration is not revocation | adapter unit test | green |
| simultaneous connections stay separate | unit test | green |
| `ROOM_ENDED` fabricates no participant evidence | unit test | green |
| open connection bounded, not fabricated | unit test | green |
| late disconnect may upgrade quality after `ROOM_ENDED` | unit test | green |
| orphan disconnect is zero-presence, not invalid | unit test | green |
| orphan disconnect self-corrects | unit test | green |
| reversed sequence is invalid and zero-presence | unit test | green |
| presence union does not double-count | unit test | green |
| reconnect counts aggregate transitions only | unit test | green |
| exact provider retry deduplicated | unit test | green |
| conflicting `providerEventRef` excluded | unit test | green |
| reducer is pure and uses explicit `asOf` | unit test | green |
| window opens at booked start, no early-join | unit test | green |
| window closes at `endAt + REJOIN_GRACE` | unit test | green |
| `EVIDENCE_HORIZON_GRACE` cannot widen the window | unit test | green |
| `REJOIN_GRACE` cannot move `analyticalHorizonAt` | unit test | green |
| derived window authorizes `opensAt`, denies `closesAt` | unit test | green |
| rejoin allowed after booked end inside grace | unit test | green |
| completion requires evidence finality | unit test | green |
| `ROOM_ENDED` alone does not make evidence final | unit test | green |
| cancelled session never completes | unit test | green |
| already-completed decision is idempotent | unit test | green |
| terminal status outranks evidence finality | unit test | green |
| unreliable evidence blocks completion | unit test | green |
| single-side attendance blocks completion | unit test | green |
| completion decision is pure | unit test | green |
| provider participant ref belongs to exactly one grant | integration test | green |
| replayed join attempt conflicts instead of granting twice | integration test | green |
| join attempt id is unique per participant, not globally | integration test | green |
| participant-field CHECK on event type | integration test | green |
| blank or untrimmed references rejected by database | integration test | green |
| duplicate webhook delivery is a database no-op | integration test | green |
| simultaneous connections stay separate rows in storage | integration test | green |
| live grant and evidence restrict destructive deletion | integration test | green |
| hand-written CHECK constraints still installed | integration test | green |
| Wave 2 booking columns and guards unchanged by Wave 3 | catalog integration test | green |
| join route denies server-side per §4 | unit route + grant service tests | green |
| elapsed session still not auto-completed | completion service does not write on time-alone | green |
| durable `COMPLETED` only from evidence | completion service + compare-and-set update | green |
| grace values fail closed when env is absent | unit env test | green |
| webhook signature verified before ingest | unit webhook route test | green |
| duplicate `providerEventRef` is an ingest no-op | unit webhook service test | green |

## 10. Milestone sequence

### M1-A — pure join authorization and provider identity boundary

Closed. `lib/domain/live-session/policy.ts` and
`lib/domain/live-session/provider.ts` with executable invariants.

### M1-B — evidence reduction and independent timing policies

Closed. `lib/domain/live-session/evidence.ts` with executable invariants.
Production grace values remain deliberately unfrozen.

### M1-C — join-window derivation and completion decision

Closed. `deriveLiveSessionJoinWindow` in `lib/domain/live-session/policy.ts` and
`decideLiveSessionCompletion` in `lib/domain/live-session/completion.ts`, with
executable invariants.

This closes the gap where `REJOIN_GRACE` was validated but never consumed, and
gives §2 an executable completion rule that performs no write.

### M2 — additive persistence

Closed. `prisma/migrations/20260823120000_add_live_session_evidence_foundation`
applies from the integrated baseline with zero drift against
`prisma/schema.prisma`, and
`tests/integration/wave3-live-session-constraints.test.ts` carries the database
level invariants.

Additivity was verified against the live database rather than inferred from the
schema diff. The nine `speaking_session` columns retain their original names,
types, and nullability, and the pre-existing booking guards
`speaking_session_exact_15m_check`, `speaking_session_start_grid_check`,
`speaking_session_teacher_active_slot_key`,
`speaking_session_student_active_slot_key`, and `tar_no_active_overlap` are all
still present. Two of those are partial unique indexes rather than constraints,
so presence must be checked against `pg_class` as well as `pg_constraint`.

Original scope, retained for review:

1. Add `SpeakingSessionLiveGrant` and `SpeakingSessionLiveEvent` with enums and
   relations, additive only.
2. Review the generated SQL against §1 and §8 before applying.
3. Prove uniqueness, idempotency, and the participant-field CHECK against a real
   isolated PostgreSQL test database.
4. Prove duplicate webhook delivery is a database-level no-op.
5. Prove no existing booking constraint, column, or transition changed.

`prisma.config.ts` resolves the migration datasource from `DIRECT_URL`, which
points at the shared Neon development database. `prisma migrate dev` must
therefore never be run for this milestone: it would target Neon and it also
requires a shadow database that the isolated test role is not privileged to
create.

The supported apply path is the one CI already uses — override `DIRECT_URL` with
the isolated test URL for the duration of a `prisma migrate deploy` invocation.
That override must not leak into the test run itself, because
`getTestDatabaseUrl` deliberately rejects a `TEST_DATABASE_URL` that shares a
database identity with `DIRECT_URL`.

### M3 — services and transport

**Status: CLOSED** against the frozen `LiveSessionProviderAdapter` with a fake
runtime adapter. Vendor selection remains open and is out of scope.

Production grace values are still unfrozen. Services read them from:

```text
LIVE_SESSION_REJOIN_GRACE_MS
LIVE_SESSION_EVIDENCE_HORIZON_GRACE_MS
LIVE_SESSION_WEBHOOK_SECRET
```

Absent, blank, or non-integer grace values fail closed. That is configuration,
not a default.

Delivered:

1. Grant issuance — `lib/services/live-session-grant.service.ts` plus
   `POST /api/sessions/[sessionId]/join`.
2. Webhook ingestion — signature seam on the adapter, persist via
   `lib/services/live-session-webhook.service.ts`,
   `POST /api/webhooks/live-session`.
3. Evidence read — `lib/services/live-session-evidence.service.ts` composing
   the pure reducer with no write,
   `GET /api/sessions/[sessionId]/live-evidence`.
4. Durable completion — `completeLiveSpeakingSession` serialized per session
   with compare-and-set `SCHEDULED → COMPLETED`, plus an internal job at
   `POST /api/internal/jobs/live-session-completion`.
5. Thin routes with stable error codes in `lib/errors/live-session-http.ts`.

Database conflicts are classified by constraint identity in
`lib/live-session/constraint-identity.ts`.

`PRISMA SCHEMA-AFFECTING: NO`

### M4 — product surface

Localized join experience in both message catalogs, RTL and LTR, with loading,
error, and denied states. No authorization logic may exist only in the UI.

## 11. Out of scope for Wave 3

- transcription and AI analysis, which belong to Wave 5;
- recording storage policy beyond recording the strategy decision;
- rescheduling;
- any change to Wave 2-owned booking columns, statuses, or transitions;
- production values for `REJOIN_GRACE` and `EVIDENCE_HORIZON_GRACE`;
- provider selection, until an adapter implementation task is authorized.

## 12. Prisma ownership and downstream communication

While Wave 3 is active, Wave 3 owns only the two additive live-session models and
their dedicated enums and relations. Booking-owned schema remains Wave 2 Track A's.

For every schema-affecting Wave 3 merge, downstream tracks must immediately:

```powershell
npm run db:generate
npm run db:validate
```

and then rerun their typecheck and tests.

Each Wave 3 merge note must state either:

```text
PRISMA SCHEMA-AFFECTING: YES
```

or:

```text
PRISMA SCHEMA-AFFECTING: NO
```

For the M1-A/M1-B domain foundation and this contract document: **NO**.
