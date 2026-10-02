# Testing guide index

The detailed testing record is in [Testing](Testing.md). This page points to
the principal suites without duplicating their instructions.

- **Unit tests** — workspace Vitest suites under `apps/` and `packages/`; use
  the focused `test:*` scripts or `pnpm test`.
- **PostgreSQL integration tests** — database and service integration suites
  use the disposable `warka_test` database through `TEST_DATABASE_URL`.
- **Playwright** — browser journeys live in `tests/e2e`; run `pnpm test:e2e`
  with the required database and application environment.
- **Accessibility** — axe-core scans and keyboard/focus journeys are part of
  Playwright coverage; manual assistive-technology review is still required.
- **Release candidate** — `pnpm test:release-candidate` composes repository
  release-candidate evidence.
- **Historical migrations** — `pnpm test:upgrade-matrix` validates the selected
  synthetic fixtures in `tests/fixtures/migrations`.
- **Load configuration** — `pnpm test:load:config` validates the harness;
  `pnpm test:load` requires an explicitly acknowledged target.
- **Security** — `pnpm security:check` composes secret, dependency, SBOM,
  workflow-policy, and checksum checks.

CI workflow ordering is defined in `.github/workflows/ci.yml`.
