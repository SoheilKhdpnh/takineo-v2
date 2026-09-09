# Track D — Public Discovery Remediation Candidate Verification

Source candidate:

`087d55da6d0a403048fc83208c1407c09382039a`

Commit subject:

`fix: bound public teacher discovery candidate work`

## Independent closure target

Re-run the original Track D adversarial population shape at exactly:

- 1,000 synthetic teachers;
- 10,000 synthetic teachers;
- never 50,000 for this closure.

Distribution is preserved:

- approximately first 90% of ordered teacher IDs are non-public;
- approximately final 10% are public;
- requested discovery page size is 40.

The candidate-specific fixture directly seeds projection membership for that
same final 10% so the test isolates read-path complexity. Projection
synchronization correctness is a separate invariant owned by the implementation
and its integration tests; this test does not replace those synchronization
tests.

## Structural acceptance

At both populations:

- projection candidate rows examined <= 41;
- projection plan touches only `public_teacher_discovery_eligibility`;
- projection uses `public_teacher_discovery_eligibility_pkey`;
- teacher-profile fetch remains O(40), not O(population);
- user lookups attributable to candidate eligibility = 0;
- intro-video lookups attributable to candidate eligibility = 0;
- availability reads remain three batched reads and page-bounded;
- returned teacher count = 40;
- keyset pagination remains deterministic with no duplicates;
- no positive/deep OFFSET;
- privacy-safe public DTO remains intact.

Latency is diagnostic only.

## Reliability follow-up

The `pg` deprecation warning about calling `client.query()` while a client is
already executing a query remains a Track D reliability / pg@9 upgrade item.
It does not affect this specific architectural blocker closure decision.
