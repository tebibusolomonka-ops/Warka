# Warka

Warka is an education platform for school records and services. This repository is a pnpm workspace for its applications and shared packages.

## Development

Use Node.js 24.11.1 and pnpm 11.25.0. Run `pnpm install` from the repository root. Applications and packages will be added as the platform develops.

## Run locally

Run `pnpm dev:api` and `pnpm dev:web` in separate terminals. Copy `apps/web/.env.example` to `apps/web/.env` before starting the web app. The Vite development server proxies `/api` to the API on port 3000. Set `VITE_API_URL` to the deployed API base URL when building for another environment.

## Database

Run `pnpm db:up` to start PostgreSQL 17. The Compose setup creates `warka` and `warka_test` databases. Use the local URLs in `.env.example` as shell environment variables; do not commit a credential-bearing `.env` file. Run `pnpm db:migrate` with `DATABASE_URL` set to each database in turn. For example, in PowerShell set `$env:DATABASE_URL` to the `warka` URL and run `pnpm db:migrate`, then set it to the `warka_test` URL and run the command again. Run `pnpm db:generate` after schema changes. Generated Prisma client files stay in `node_modules`. Stop the service with `pnpm db:down`.

## Repository integration tests

Set `TEST_DATABASE_URL` to the migrated `warka_test` database and run `pnpm db:test`. When `TEST_DATABASE_URL` is absent, tests use `DATABASE_URL`; when neither is present, they skip. Use a disposable database for integration tests because they write and remove records.
## School directory

The web directory stores the selected organization ID in browser storage for local use. Create an organization in the page or enter an existing ID, then add schools under it. This is a development workflow; it does not provide authentication or organization discovery.

## Initial owner

Set `DATABASE_URL` to a migrated database and supply a strong `WARKA_OWNER_PASSWORD` in the operator shell. Run `pnpm auth:bootstrap --email <email> --display-name "<name>" --organization "<organization>"`. Remove the password environment variable afterward. The command creates one user, password credential, organization, and owner membership in a transaction. It rejects an existing email or organization name.