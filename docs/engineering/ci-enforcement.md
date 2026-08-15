# CI enforcement

Milestone 16 extends the existing GitHub Actions workflow so every merge to `main` is backed by the same quality, isolated PostgreSQL, and browser acceptance layers used during Wave 1 delivery.

## Required branch-protection checks

The existing workflow remains `.github/workflows/ci.yml` and keeps the workflow name `CI` plus its `main` push/pull-request triggers, read-only repository permission, and cancel-in-progress concurrency.

Configure branch protection for `main` so these three job names are required before merge:

- `Quality`
- `Integration`
- `Browser E2E`

Do not bypass a failed required check for a normal merge. If an emergency repository-owner bypass is ever used, record the incident and restore a green main branch immediately afterward.

## Quality job

`Quality` preserves the existing Node 24/npm install and Prisma/lint/type/build steps, then adds the complete unit suite:

```text
npm run db:generate
npm run db:validate
npm run lint
npm run typecheck
npm run build
npm run test:unit
```

Its database URLs are syntax-only localhost placeholders. This job has no PostgreSQL service and does not require or receive production database credentials.

## Integration isolation

`Integration` starts a fresh PostgreSQL 18 service container for that job only. It creates two different localhost identities:

- protected application placeholder: `takineo_ci_app@127.0.0.1:5432/takineo_ci_app`
- integration database: `takineo_test@127.0.0.1:5432/takineo_test`

During the actual test process, `DATABASE_URL` and `DIRECT_URL` remain on `takineo_ci_app` while `TEST_DATABASE_URL` points to `takineo_test`. This keeps the runtime fail-closed inequality guard meaningful.

The migration step temporarily overrides `DIRECT_URL` for that one command only so checked-in Prisma migrations are applied to `takineo_test`; the job-level protected application URL is automatically restored for the test step.

Before the suite runs, CI prints the non-secret live tuple returned by PostgreSQL (`current_database`, `current_user`, server address, and port). The integration test suite independently verifies the same identity.

## Browser E2E isolation

`Browser E2E` receives a different fresh PostgreSQL service container from the integration job. It creates three distinct identities inside that job:

- `takineo_ci_app` — protected application placeholder
- `takineo_test` — integration identity used as a separation sentinel
- `takineo_e2e` — destructive Playwright database

The job sets the canonical E2E URL and explicit destructive-reset acknowledgement, then delegates all destructive work to the existing Playwright safety harness. The harness must still verify the URL, verify the live database/user/address/port, reset only `takineo_e2e`, apply migrations, seed personas, and remap the Playwright-owned application runtime.

CI does not weaken the guard that forbids the E2E database runtime under `NODE_ENV=production`.

## Browser installation and diagnostics

The browser job installs Chromium and its Linux dependencies with:

```bash
npx playwright install --with-deps chromium
```

If browser acceptance fails, `playwright-report/` and `test-results/` are uploaded for seven days so screenshots, retained videos, error context, and traces remain available for diagnosis.

## CI credential policy

The PostgreSQL passwords and placeholder application values committed in the workflow are deliberately disposable credentials for ephemeral localhost service containers. They are not production secrets and are not valid outside the job that creates those roles/databases.

Never commit or inject production values into this workflow for:

- Neon/application database credentials
- Better Auth production secret
- Mux API, webhook, or signing credentials
- `INTERNAL_JOB_SECRET`
- Healthchecks ping URLs

If a future CI scenario genuinely requires an external secret, store it in GitHub repository/environment secrets, scope it to the smallest possible job, and make sure untrusted pull requests cannot access it.

## Action and platform maintenance

The repository already has Dependabot coverage for the `github-actions` ecosystem. Continue reviewing action-major upgrades before merging them. Keep Node aligned with the repository's Node 24 policy and keep the PostgreSQL service pinned to a deliberate major rather than `latest`.

When a new mandatory acceptance layer is added, update both this document and branch protection in the same change so a test is not merely present in the repository but unenforced at merge time.
