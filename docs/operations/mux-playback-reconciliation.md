# Mux Playback Reconciliation Operations

This runbook owns the production execution and monitoring contract for the
approved-public-playback reconciliation worker.

The worker reconciles Takineo's database intent with Mux. It is deliberately
separate from private admin review playback.

## Production topology

```text
Netlify Scheduled Function (every minute)
  -> Healthchecks.io start signal
  -> POST /api/internal/jobs/mux-playback-reconciliation
       x-takineo-job-secret: INTERNAL_JOB_SECRET
       { "limit": 10 }
  -> processDueMuxPlaybackReconciliations()
  -> Mux provider operations
  -> operational health snapshot
  -> Healthchecks.io success or failure signal
```

The browser never invokes the scheduler and never receives either operational
secret.

### Scheduler

Production scheduler: Netlify Scheduled Functions.

Function:

```text
netlify/functions/mux-playback-reconciliation.mjs
```

Schedule:

```text
* * * * *
```

The function runs only for the published production deploy. It processes a
bounded batch of 10 records and aborts its HTTP wait after 20 seconds so the
adapter remains inside the scheduled-function execution budget.

A timed-out caller does not imply that the underlying reconciliation failed.
The reconciliation service is lease-fenced and retry-safe; the next invocation
must re-read authoritative state rather than assuming the previous call did or
did not commit.

## Authentication and secret ownership

Required production runtime variable:

```text
INTERNAL_JOB_SECRET
```

Requirements:

- generated with high entropy
- at least 32 characters (enforced by application configuration)
- stored through the Netlify environment-variable UI/CLI/API, not in `netlify.toml`
- available to Functions runtime; when scope controls are available, grant only the scopes actually required
- never committed to Git
- never exposed through `NEXT_PUBLIC_*`
- never printed in logs, screenshots, tickets, or runbook examples

The internal Route Handler compares the supplied secret using a timing-safe
comparison and fails closed when the secret is absent or incorrect.

## Independent heartbeat monitoring

Production monitoring uses one Healthchecks.io cron check.

Store its unique ping URL in Netlify as:

```text
MUX_RECONCILIATION_HEALTHCHECK_URL
```

Treat this URL as a secret because possession of it allows another party to
forge heartbeat signals.

Recommended check configuration:

```text
Schedule: * * * * *
Timezone: UTC
Grace time: 3 minutes
```

Signals:

- `/start` before the scheduled job begins
- base ping URL after a healthy job completes
- `/fail` when the internal job returns a non-success status or the scheduler
  invocation throws

A missing success heartbeat therefore detects a missed Netlify schedule, a
scheduler crash, a deployment/configuration break, or an execution that never
completed. A failure signal allows immediate alerting for a known unhealthy
run.

Heartbeat delivery is observability, not a correctness dependency. If the
monitoring provider is unavailable, Takineo logs the monitor error and still
runs reconciliation.

## Operational health thresholds

After each batch, the private internal route calculates a fresh database health
snapshot.

The job is `DEGRADED` and returns HTTP `503` when either condition is true:

1. at least one reconciliation has been due for **15 minutes or longer**; or
2. at least one reconciliation is `FAILED` after **5 or more attempts**.

The response contains aggregate operational data only:

```text
status
due
overdue
durableFailures
oldestDueAt
thresholds
```

It does not expose teacher identity, Mux asset IDs, playback IDs, signing
credentials, or other provider identifiers.

A single transient provider failure does not immediately make the whole worker
unhealthy. Existing retry behavior remains authoritative:

```text
30 seconds -> exponential backoff -> maximum 1 hour
```

## Overlap and duplicate execution safety

Netlify may invoke a later schedule while another request is still resolving,
and operators may also use `Run now` during a scheduled invocation.

Correctness does not depend on scheduler-level mutual exclusion.

Each reconciliation record already uses:

- a random lease token
- a lease expiry
- intent generation fencing
- video-revision fencing
- conditional atomic claims
- conditional finalization

Only the worker that owns the current generation/revision/lease may perform or
finalize provider work. A competing invocation skips a record it cannot claim.
Expired leases can be reclaimed safely.

Do not remove these fences merely because the current scheduler normally runs
once per minute.

## Structured logs

The Netlify scheduler emits compact JSON events.

Healthy/degraded invocation summary:

```text
mux_playback_reconciliation_schedule
```

Scheduler or internal-job failure:

```text
mux_playback_reconciliation_schedule_error
```

Heartbeat-provider delivery failure:

```text
mux_playback_reconciliation_monitor_error
```

Heartbeat missing from deployment configuration:

```text
mux_playback_reconciliation_monitor_not_configured
```

The summary may contain aggregate batch counts and health counts only. Never
add Mux credentials, private playback tokens, user email addresses, review
reasons, or full provider error bodies to these log events.

## Alert policy

The production Healthchecks.io check must have at least one notification target
enabled before Wave 1 production readiness can be closed.

Minimum alert policy:

- explicit `/fail`: alert immediately
- no successful heartbeat for the one-minute schedule plus 3-minute grace:
  alert as missed schedule
- repeated alerts remain open until a healthy success heartbeat is observed

Email is sufficient for the first operator. Add a second notification channel
when Takineo has shared operational ownership.

Netlify function logs and metrics remain the first troubleshooting source; the
external heartbeat is the independent dead-man alert.

## Deployment checklist

Before enabling production scheduling:

1. Confirm `INTERNAL_JOB_SECRET` exists in the Netlify production environment.
2. Confirm `MUX_RECONCILIATION_HEALTHCHECK_URL` exists in the Netlify production
   environment.
3. Confirm the Healthchecks check uses `* * * * *`, UTC, with 3 minutes of
   grace.
4. Confirm at least one Healthchecks notification integration is enabled.
5. Deploy the production build.
6. Open the Netlify Functions page and confirm
   `mux-playback-reconciliation` is marked as Scheduled.
7. Use Netlify **Run now** once.
8. Verify one `start` and one successful heartbeat event.
9. Verify the Netlify function log contains
   `mux_playback_reconciliation_schedule` with `ok: true`.
10. Confirm the internal job response contains `health.status: "HEALTHY"`.

Do not consider the scheduler operational merely because the code deployed.
The heartbeat and notification checks above are part of activation.

## Manual execution

Preferred production manual execution is Netlify's **Run now** action for the
scheduled function because it uses the same deployment and environment as the
automatic schedule.

The repository also contains:

```text
npm run ops:mux-reconcile -- --limit <1-50>
npm run ops:mux-reconcile -- --id <reconciliation-id>
```

The `--id` form forces immediate verification, including a terminal succeeded
intent. Use direct CLI execution against production only from an explicitly
authorized operator environment with production database and Mux credentials.
Never copy production credentials into a developer `.env` merely to run this
command.

## Incident response

### Missed heartbeat

1. Check Netlify's published deploy and Scheduled Function next-run state.
2. Check the function log for configuration, timeout, or internal-route errors.
3. Confirm the two required environment variables still exist.
4. Use **Run now**.
5. If Run now succeeds, verify Healthchecks receives the success ping.
6. If the internal route reports overdue work, continue running bounded batches
   until `overdue` returns to zero.

### Durable reconciliation failure

1. Read `durableFailures`, `overdue`, and `oldestDueAt` from the private job
   response/log summary.
2. Inspect the affected reconciliation records directly through an authorized
   operator database workflow; do not expose a browser endpoint for this.
3. Check `lastErrorCode`, desired state, attempt count, and current teacher/video
   eligibility.
4. Check Mux provider status and the relevant asset through authorized provider
   tooling.
5. Correct the provider/configuration issue first.
6. Use the existing operator reconciliation CLI with an exact reconciliation ID
   only when an immediate forced verification is justified.
7. Confirm the next scheduled run returns `HEALTHY` and Healthchecks recovers.

## Secret rotation

### `INTERNAL_JOB_SECRET`

1. Generate a new high-entropy value of at least 32 characters.
2. Replace the Netlify production environment variable.
3. Trigger a production deploy so the published Next.js route and scheduled
   function use the same value.
4. Use **Run now** and verify a healthy result.
5. Remove the old value from any approved secret manager/history according to
   the team's retention policy.

Do not temporarily weaken the route to accept unauthenticated requests during
rotation.

### `MUX_RECONCILIATION_HEALTHCHECK_URL`

1. Create a replacement Healthchecks check and configure its notification
   target first.
2. Replace the Netlify environment variable.
3. Deploy and use **Run now**.
4. Verify the new check receives start/success signals.
5. Disable the old check.

## Security boundary

The internal route is not an administrative browser API. Do not link it from
UI code, expose its secret in client bundles, add CORS access, or create a
public status page that proxies its response.

The scheduled adapter logs only aggregate operational metadata. Provider IDs,
private review tokens, signing keys, and internal admin reasons stay outside the
scheduler/monitoring boundary.
