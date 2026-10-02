# Project command reference

All commands run from the repository root.

## Development

- `pnpm dev:web` — start the Vite web server.
- `pnpm dev:api` — start the API development server.
- `pnpm build` — generate Prisma and build all workspace packages.
- `pnpm typecheck` — build and type-check the workspace.
- `pnpm lint` — run ESLint.
- `pnpm format:check` — check Prettier formatting.

## Database

- `pnpm db:up` — start the development PostgreSQL service.
- `pnpm db:down` — stop Compose without requesting volume removal.
- `pnpm db:generate` — generate the Prisma client.
- `pnpm db:validate` — validate the Prisma schema.
- `pnpm db:migrate` — deploy committed migrations to `DATABASE_URL`.
- `pnpm db:preflight` — inspect schema and migration readiness without repair.
- `pnpm db:test` — run database tests against the configured test database.

## Testing

- `pnpm test` — build and run workspace tests.
- `pnpm test:web`, `pnpm test:api`, `pnpm test:auth`, `pnpm test:database` — run focused suites.
- `pnpm test:e2e` — build and run Playwright journeys.
- `pnpm test:load:config` — validate load-harness configuration.
- `pnpm test:upgrade-matrix` — validate selected historical fixtures.
- `pnpm test:release-candidate` — run the release-candidate suite.

## Security

- `pnpm security:secrets` — scan tracked content for secret patterns.
- `pnpm security:audit` — apply dependency audit policy.
- `pnpm security:dependencies` — report dependency metadata.
- `pnpm security:sbom` — generate SBOM evidence.
- `pnpm security:check` — run the combined security checks.

## Deployment

- `pnpm containers:check` — validate container context and policy.
- `pnpm deployment:manifest:check` — validate deployment manifests.
- `pnpm deployment:smoke` — run the configured smoke check.
- `pnpm deployment:rollout` — evaluate the rollout plan.
- `pnpm deployment:rollback` — evaluate rollback policy.
- `pnpm readiness:check` — report production-readiness evidence.

## Release

- `pnpm release:check` — validate release version consistency.
- `pnpm release:checksums` — validate release checksums.
- `pnpm acceptance:check` — report acceptance evidence.
- `pnpm runbooks:check` — validate runbook references.
- `pnpm release:audit` — compose release evidence.

## Metrics

- `pnpm metrics:code` — count committed implementation files and nonempty lines.
- `pnpm i18n:check` — validate localization catalogs and critical coverage.
