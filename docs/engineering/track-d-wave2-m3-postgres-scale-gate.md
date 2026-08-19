# Track D — Wave 2 M3 PostgreSQL / Synthetic Scale Gate

This gate is independent Track D evidence layered after:

- Track A M3 discovery implementation (`9d3b80d`, consumed as `4446427`);
- Track D M3 unit/security close (`b3c98d6`).

It does not modify Track A domain code or Prisma schema.

## Real PostgreSQL acceptance

`tests/integration/wave2-discovery-postgres-adversarial.test.ts` runs the
production discovery service against the isolated local `takineo_test`
PostgreSQL database through `PrismaPg`.

It verifies:

- exact isolated database identity;
- mixed eligibility at the storage layer;
- public DTO privacy with deliberately populated private review/provider data;
- explicit keyset pagination after the prior cursor teacher becomes non-public;
- constant actual Prisma SELECT count when page cardinality grows;
- lookahead row exclusion from availability reads;
- no emitted OFFSET query;
- large historical session volume outside the requested Tehran window cannot
  alter next availability;
- the emitted speaking-session query carries both Tehran-derived range bounds.

## Synthetic cardinality probe

`tests/integration/wave2-discovery-synthetic-scale.test.ts` supports:

- 1,000 teachers;
- 10,000 teachers;
- 50,000 teachers.

Each run uses a unique prefixed disposable fixture set and cleans it afterward.

The dataset is intentionally adversarial:

- every profile is application-approved and complete;
- intro video is approved;
- only the final 10% of ordered teacher accounts are active/public;
- every teacher has a recurring rule, so the rule table grows with scale;
- every teacher has a historical exception outside the requested range;
- every teacher has one historical completed speaking session outside the
  requested range.

This arrangement is designed to expose candidate-page work that grows with the
whole teacher population while keeping the requested result page fixed at 40.

## Evidence captured

For each scale the probe:

1. calls the real `listPublicTeachers()` service through PrismaPg;
2. records emitted Prisma SELECT events;
3. proves the SELECT count is constant over repeated page reads;
4. proves OFFSET is absent;
5. runs 10 sequential page reads and records p50/p95/p99/min/max;
6. runs a deep keyset cursor read;
7. runs 10 concurrent reads and records failures;
8. replays representative emitted SELECTs through PostgreSQL
   `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`;
9. records relation scans, index names, actual rows, loops, removed rows, and
   estimated rows;
10. emits one machine-readable `TRACK_D_DISCOVERY_SCALE_METRIC` JSON line.

## Classification

Architectural blockers remain independent of latency:

- N+1 queries;
- unbounded recurrence/date expansion;
- unbounded page size;
- unnecessary all-history session scans;
- raw ORM / `SELECT *` public DTOs;
- O(all teachers) work to produce one page;
- OFFSET/Prisma `skip` pagination for M3 discovery.

Synthetic latency is diagnostic only. A 50k-teacher p95 is not automatically a
Wave 2 launch SLA violation.

The scale metric should be compared across 1k / 10k / 50k. In particular,
`eligibilityRowsExamined` and its fraction of total synthetic teachers are
structural evidence for or against O(all-teachers) candidate-page work.
