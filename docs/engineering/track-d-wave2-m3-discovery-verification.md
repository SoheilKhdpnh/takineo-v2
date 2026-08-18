# Track D — Wave 2 M3 Discovery Verification

**Track A M3 source:** `9d3b80d` (`feat: add wave2 public teacher discovery`)
**Track D consumed M3:** `4446427`
**Booking foundation Track D close:** `20251a6`
**Scheduling authority:** `Asia/Tehran`

## Preconditions proven before independent binding

- Track A discovery service/route feature tests: 24/24 green.
- Track A batch next-availability tests: 5/5 green.
- TypeScript: green.
- ESLint: zero errors.
- Discovery page-size ceiling: 40.
- Pagination: explicit `id > cursor`, ordered `id asc`, `take = limit + 1`.
- Batch projection: recurring rules, exceptions, and occupied sessions are read in batch.
- Batch service unit evidence proves query count does not grow with teacher-page cardinality.
- Occupied-session lookup is bounded to the requested Tehran date window.

## Track D independent attacks added

### Service boundary

- Poison repository rows with review/account/provider-private fields and prove the public DTO remains an explicit allowlist.
- Feed stale/ineligible rows despite the SQL eligibility predicate and prove defensive eligibility filtering prevents them from entering availability projection.
- Reject abusive direct-service page sizes before PostgreSQL access.
- Reject non-canonical cursors before PostgreSQL access.
- Verify only the requested page (not the lookahead row) enters next-availability projection.

### Route boundary

- Reject zero, negative, fractional, NaN, infinite, and oversized page sizes without invoking discovery.
- Reject whitespace/non-canonical cursors without invoking discovery.
- Probe unsupported private/search-like query parameters and prove they cannot become hidden enumeration/search semantics.
- Verify canonical cursor is forwarded only as the opaque keyset boundary.

## Architectural blockers

These remain blockers independently of any synthetic latency result:

1. N+1 database queries.
2. Unbounded recurrence/date expansion.
3. Unbounded page size.
4. Unnecessary all-history speaking-session scans.
5. Raw ORM / `SELECT *` public DTO exposure.
6. O(all teachers) database work to produce one page.
7. OFFSET/`skip` pagination where the M3 contract is keyset-based.

## Synthetic scale policy

1k / 10k / 50k datasets are complexity probes. They are not Wave 2 launch latency SLAs unless the Engineering Control Room explicitly creates an SLA.

The k6 harness intentionally defines no p95/p99 threshold. Report observed latency, throughput, error rate, database/query behavior, CPU, memory, and connection-pool behavior separately from architectural pass/fail.
