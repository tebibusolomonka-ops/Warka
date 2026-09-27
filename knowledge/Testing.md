# Testing

Vitest covers web, API, authentication, database services, and permission boundaries. PostgreSQL integration tests require a disposable database. Playwright covers synthetic browser journeys with cleanup. CI runs the database-backed checks that this local environment cannot run.

During a batch, run focused tests, TypeScript checks, and relevant schema checks per commit. Run full unit, database integration, browser, lint, format, typecheck, build, and Prisma validation at the final batch commit. Never present discovery or mocked process tests as a live PostgreSQL backup or restore.
