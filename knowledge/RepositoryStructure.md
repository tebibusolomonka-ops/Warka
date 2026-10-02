# Repository structure

- `apps/web` — React and Vite user interface, browser API clients, responsive
  components, localization controls, and frontend tests.
- `apps/api` — Fastify application, authenticated routes, service composition,
  readiness, schedulers, and API tests.
- `packages/shared` — shared contracts, validation schemas, localization data,
  and cross-application utilities.
- `packages/auth` — password, session, recovery, and initial-owner bootstrap
  operations.
- `packages/database` — Prisma client exports and domain persistence services.
  Its `prisma/schema.prisma` and `prisma/migrations/` are the database schema and
  forward migration history.
- `knowledge` — durable architecture, decisions, testing notes, release
  evidence, batch history, and operational runbooks.
- `config` — repository-owned acceptance and validation configuration.
- `deploy` — gateway and web-runtime configuration. Root Dockerfiles and Compose
  files define local and reference production containers.
- `scripts` — noninteractive validation, security, deployment, recovery,
  release, migration, metrics, and evidence commands exposed by `package.json`.
- `tests/e2e` — Playwright journeys based on synthetic test data.
- `tests/fixtures` — bounded synthetic fixtures, including selected migration
  milestones.
- `.github/workflows` — CI orchestration and required repository checks.

Start with `README.md`, `CONTRIBUTING.md`, and [Architecture](Architecture.md)
before changing implementation or schema behavior.
