# Local troubleshooting

## pnpm is not recognized

Use the repository-pinned version through Corepack:

```powershell
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm --version
```

Open a new PowerShell window if PATH changed. Do not upgrade the lockfile or
substitute an unpinned pnpm version.

## Docker or PostgreSQL is unavailable

Start Docker Desktop, confirm `docker info` succeeds, then run `pnpm db:up`.
Use `docker compose ps` to confirm `waka-db-1` is healthy. Do not remove the
`waka_postgres_data` volume when troubleshooting an existing database.

## Prisma reports Windows DLL EPERM

`query_engine-windows.dll.node` can be locked by a running API or test process.
Stop only Node processes launched from this repository, rerun
`pnpm db:generate`, and restart the development servers. Reinstalling
dependencies is normally unnecessary.

## Port 3000 or 5173 is already in use

Use `Get-NetTCPConnection -State Listen -LocalPort 3000,5173` to identify the
listener. Reuse or stop the existing Warka development process; do not stop an
unrelated Node process.

## Database connection errors

Confirm `DATABASE_URL` matches `.env.example`, the Compose service is healthy,
and committed migrations have been applied with `pnpm db:migrate`.
