# Warka

Warka is an education platform for school records and services. This repository is a pnpm workspace for its applications and shared packages.

## Development

Use Node.js 24.11.1 and pnpm 11.25.0. Run `pnpm install` from the repository root. Applications and packages will be added as the platform develops.

## Run locally

Run `pnpm dev:api` and `pnpm dev:web` in separate terminals. Copy `apps/web/.env.example` to `apps/web/.env` before starting the web app. The Vite development server proxies `/api` to the API on port 3000. Set `VITE_API_URL` to the deployed API base URL when building for another environment.

## Database

Copy `.env.example` to `.env` and set a PostgreSQL connection URL before running database commands. Run `pnpm db:generate` after schema changes. Generated Prisma client files stay in `node_modules`.
