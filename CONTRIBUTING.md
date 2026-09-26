# Contributing to Warka

Warka uses React, TypeScript, Fastify, Zod, PostgreSQL, Prisma, Vitest, and Playwright. Use the Node and pnpm versions in the root package files.

## Workspace

- `apps/web` contains the React interface and browser API clients.
- `apps/api` contains authenticated Fastify routes and application services.
- `packages/database` contains Prisma models, migrations, and domain persistence services.
- `packages/auth` contains password and session operations.
- `packages/shared` contains contracts shared by the web and API.
- `tests/e2e` contains browser journeys.

## Implementation

Keep TypeScript strict and validate untrusted input at service and API boundaries. Follow existing domain services and repositories instead of duplicating rules in routes or React components. Keep React state local where practical, render server data as text, and use accessible labels, keyboard-friendly controls, and clear loading and error states.

Enforce authorization in the API and domain layer for every school, organization, student, and guardian operation. A visible control does not grant permission. Use transactions for workflows that update related records together. Audit privileged changes and sensitive exports without putting personal data or credentials in audit metadata.

Use simple names and self-explanatory code. Avoid filler code, unnecessary abstractions, and authored source comments. Never commit real credentials or personal records; fixtures must use synthetic data.

## Database and tests

Create a new Prisma migration for every schema change. Do not edit applied migrations. Generate the Prisma client after schema changes and test migration behavior against a disposable PostgreSQL database.

Run targeted Vitest tests and type checks while developing. Cover permission boundaries, school scope, state transitions, and transaction rollback when they matter. Before completing a batch, run the full unit and PostgreSQL suites, Playwright journeys where the environment supports them, lint, formatting, TypeScript checks, and production builds. Keep browser tests based on synthetic fixtures and clean up created records.
