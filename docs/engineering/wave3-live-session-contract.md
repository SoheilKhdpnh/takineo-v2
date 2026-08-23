# Wave 3 Live Speaking Session Contract

**Owner:** Wave 3 — Live Speaking (`feat/wave3-live-speaking`)
**Canonical operational timezone:** `Asia/Tehran`
**Reconciled baseline:** `integration/wave2-final` (`12ebf3ad`)
**Upstream handoff:** `docs/engineering/wave2-domain-contract.md` §8, §17
**M1-A status:** **CLOSED — join authorization, provider identity boundary, and evidence reduction are frozen as pure domain rules with executable invariants.**
**M1-B status:** **CLOSED — `REJOIN_GRACE` and `EVIDENCE_HORIZON_GRACE` are frozen as two independent policies. Their production values remain deliberately unfrozen.**

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
not a stylistic preference.

## 4. Join authorization

Join authorization is a pure decision over a session snapshot, an actor
snapshot, an explicit join window, and an explicit `asOf`.

The join window uses the same half-open convention Wave 2 locked in:

```text
[opensAt, closesAt)
```

`asOf == closesAt` is closed, not open.

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
| grant uniqueness and idempotency at database level | **migration + integration test required** | pending |
| participant-field CHECK on event type | **migration + integration test required** | pending |
| duplicate webhook delivery is a database no-op | **integration test required** | pending |
| join route denies server-side per §4 | **route test required** | pending |
| elapsed session still not auto-completed | **regression test required** | pending |
| durable `COMPLETED` only from evidence | **service test required** | pending |

## 10. Milestone sequence

### M1-A — pure join authorization and provider identity boundary

Closed. `lib/domain/live-session/policy.ts` and
`lib/domain/live-session/provider.ts` with executable invariants.

### M1-B — evidence reduction and independent timing policies

Closed. `lib/domain/live-session/evidence.ts` with executable invariants.
Production grace values remain deliberately unfrozen.

### M2 — additive persistence

1. Add `SpeakingSessionLiveGrant` and `SpeakingSessionLiveEvent` with enums and
   relations, additive only.
2. Review the generated SQL against §1 and §8 before applying.
3. Prove uniqueness, idempotency, and the participant-field CHECK against a real
   isolated PostgreSQL test database.
4. Prove duplicate webhook delivery is a database-level no-op.
5. Prove no existing booking constraint, column, or transition changed.

### M3 — services and transport

1. Grant issuance service with join authorization from §4 and idempotency from §5.
2. Provider webhook ingestion, signature-verified and idempotent.
3. Evidence read service composing the pure reducer.
4. Durable completion transition per §2, serialized per session.
5. Route handlers as thin adapters with stable machine-readable error codes.

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
