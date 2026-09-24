# Warka

Warka is an education platform for school records and services. This repository is a pnpm workspace for its applications and shared packages.

## Development

Use Node.js 24.11.1 and pnpm 11.25.0. Run `pnpm install` from the repository root.

## Run locally

Run `pnpm dev:api` and `pnpm dev:web` in separate terminals. Copy `apps/web/.env.example` to `apps/web/.env` before starting the web app. The Vite development server proxies `/api` to the API on port 3000. For production, serve the API under the web app's origin at `/api` and set `VITE_API_URL=/api` so the session cookie is sent with API requests.

## Database

Run `pnpm db:up` to start PostgreSQL 17. The Compose setup creates `warka` and `warka_test` databases. Use the local URLs in `.env.example` as shell environment variables; do not commit a credential-bearing `.env` file. Run `pnpm db:migrate` with `DATABASE_URL` set to each database in turn. For example, in PowerShell set `$env:DATABASE_URL` to the `warka` URL and run `pnpm db:migrate`, then set it to the `warka_test` URL and run the command again. Run `pnpm db:generate` after schema changes. Generated Prisma client files stay in `node_modules`. Stop the service with `pnpm db:down`.

## Repository integration tests

Set `TEST_DATABASE_URL` to the migrated `warka_test` database and run `pnpm db:test`. When `TEST_DATABASE_URL` is absent, tests use `DATABASE_URL`; when neither is present, they skip. Use a disposable database for integration tests because they write and remove records.

## Initial owner

Set `DATABASE_URL` to a migrated database and supply a strong `WARKA_OWNER_PASSWORD` in the operator shell. Run `pnpm auth:bootstrap --email <email> --display-name "<name>" --organization "<organization>"`. Remove the password environment variable afterward. The command creates one user, password credential, organization, and owner membership in a transaction. It rejects an existing email or organization name.

## Web access

Sign in with the provisioned account. The page lists organizations granted to the signed-in user and shows school management for organization owners and administrators. An account with only school-level assignments has no organization directory access in the current API.
