# Track D — Wave 2 Independent Verification

**Baseline:** `3201e32`
**Owner:** Track D — Security / Reliability / Observability / Operations
**Domain owner:** Track A
**Scheduling authority:** `Asia/Tehran`

## Ownership boundary

Track D verifies and attacks the established Wave 2 contract.

Track D does **not**:

- redefine booking/discovery semantics;
- silently modify booking/discovery schema;
- introduce atomic rescheduling;
- derive `COMPLETED` from elapsed time;
- invent the final M3 discovery API, ranking, public DTO, or cursor encoding.

Foundational domain/schema defects are reported to Track A.

## Booking adversarial evidence

The Track D runner exercises:

- booking DB conflict/concurrency barriers;
- idempotency replay/conflict behavior;
- half-open `[start,end)` boundaries;
- `Asia/Tehran` civil-time equivalence under multiple runtime `TZ` environments;
- cancellation ownership/history and DB constraints;
- elapsed `SCHEDULED` sessions remaining non-`COMPLETED`;
- public-teacher privacy allowlisting;
- session enumeration/ownership boundaries;
- stale discovery eligibility being rechecked at booking time.

The stale-eligibility test is intentionally endpoint-independent until M3 exists. It models a previously valid discovery snapshot followed by a current, non-public teacher state inside the booking transaction and asserts that no session is inserted.

## Discovery scaffolding before M3

Prepared but deliberately **not bound** to an endpoint:

- eligibility matrix fixtures;
- 1k / 10k / 50k synthetic identity builders;
- forbidden public-field guard;
- constant-query-count guard;
- generic k6 harness requiring an explicit `DISCOVERY_TARGET_URL`.

## Architectural blockers

These block review regardless of synthetic dataset size:

1. N+1 queries.
2. Unbounded recurrence expansion.
3. Unbounded page sizes.
4. Unnecessary scans of all historical sessions.
5. `SELECT *` / raw ORM objects crossing the public DTO boundary.
6. O(all teachers) work to produce one page.
7. Pathological deep OFFSET pagination when the Track A contract uses keyset pagination.

Synthetic 1k / 10k / 50k runs are diagnostic complexity probes. They are **not** launch latency SLAs unless the Engineering Control Room explicitly sets such an SLA.

## M3 binding gate

After Track A M3 lands:

1. Run Track A M3 feature tests first.
2. Bind Track D discovery tests to the actual service/route without changing its semantics.
3. Verify public eligibility and stale eligibility.
4. Verify enumeration/privacy differential behavior.
5. Verify deterministic keyset pagination and abusive limit/cursor handling.
6. Instrument candidate, recurring-rule, exception, and active-session query calls.
7. Prove query count stays batch-shaped as candidate count grows.
8. Inspect query plans/row scope for bounded history/horizon access.
9. Run synthetic 1k / 10k / 50k loads and report p50/p95/p99, DB/query counts, error rate, memory/CPU observations.
10. Classify findings as:
    - architectural blocker;
    - security/privacy defect;
    - correctness defect;
    - performance observation;
    - benchmark-only observation.
11. Send foundational corrections to Track A.
12. Re-run after fixes.
