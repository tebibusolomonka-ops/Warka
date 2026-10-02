# Deployment documentation index

- **Runtime containers** — `Dockerfile.api` and `Dockerfile.web` define the API
  and web images. `pnpm containers:check` validates repository policy.
- **Compose topology** — `compose.production.yml` is the single-host production
  reference. `compose.yaml` contains the local PostgreSQL service.
- **Gateway** — `deploy/gateway/Caddyfile` defines the reference edge gateway;
  `deploy/web/nginx.conf` and `deploy/web/entrypoint.sh` configure the web image.
- **Migration deployment** — [Database migration](Runbooks/DatabaseMigration.md)
  documents preflight, deployment, and stop conditions.
- **Deployment manifests** — `pnpm deployment:manifest:check` validates the
  production manifest inputs and image identities.
- **Rollout** — [Production deployment](Runbooks/ProductionDeployment.md) and
  `pnpm deployment:rollout` cover the controlled rollout plan.
- **Rollback** — [Rollback](Runbooks/Rollback.md) and
  `pnpm deployment:rollback` cover application rollback boundaries.
- **Health gates** — `/health`, `/ready`, `pnpm db:preflight`,
  `pnpm deployment:smoke`, and `pnpm readiness:check` provide distinct health,
  dependency, migration, smoke, and evidence checks.

Release-level boundaries and remaining evidence are recorded in
[Release readiness](Releases/ReleaseReadiness.md).
