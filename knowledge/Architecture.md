# Architecture

- `apps/web`: React workspaces and typed API clients; controls aid users but do not grant access.
- `apps/api`: Fastify routes, request validation, application services, audit and notification orchestration.
- `packages/shared`: cross-boundary contracts. `packages/database`: Prisma schema, migrations, repositories, and transactional domain operations. `packages/auth`: credentials and database-backed sessions.
- Authentication uses HttpOnly cookies; API and domain services enforce authorization. School, organization, student, guardian, bureau, and temporary support scopes are distinct.
- Student and guardian portals use their own relationship checks. Bureau access has dedicated authorization. Support access is temporary and school-scoped.
- Notifications are persisted and scoped to recipients. Documents and published results use issued snapshots. Reporting uses named exports and scoped views. Governance includes review workflows, privacy requests, correction routing, retention holds, and non-destructive evaluation.

See [[DomainModel]], [[Decisions]], and [[Security]].
