# Local development quickstart

## Prerequisites

- Windows with Docker Desktop running
- Node.js 24.11.1
- Corepack and pnpm 11.25.0, as pinned by `package.json`

From the repository root, enable the pinned package manager and install the
workspace when dependencies are not already present:

```powershell
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install
```

## Database

Start the PostgreSQL 17 development service without removing its named volume:

```powershell
pnpm db:up
$env:DATABASE_URL = "postgresql://warka:warka_dev@localhost:5432/warka?schema=public"
pnpm db:generate
pnpm db:migrate
```

The Compose initialization also creates `warka_test`. Use the
`TEST_DATABASE_URL` from `.env.example` only for disposable integration tests.

## Applications

Copy `apps/web/.env.example` to `apps/web/.env`. In the API terminal, retain
`DATABASE_URL` and set the documented local origin:

```powershell
$env:PUBLIC_BASE_URL = "http://localhost:3000"
$env:WARKA_ALLOWED_ORIGINS = "http://localhost:5173"
pnpm dev:api
```

In a second terminal:

```powershell
pnpm dev:web
```

Open `http://localhost:5173`. The API is at `http://localhost:3000`, with
health at `/health` and readiness at `/ready`.
