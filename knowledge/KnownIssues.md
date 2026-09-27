# Known issues

- Local PostgreSQL and Docker are unavailable in the current development environment. Clean migration deployment and database-backed journeys require CI or another PostgreSQL environment.
- Native PostgreSQL backup and restore tooling availability must be checked in the deployment environment.
- Backup policy due times and cleanup eligibility are modeled; production scheduling and artifact deletion are not yet wired to a deployment scheduler.

Resolved prior validation failures are recorded in [[Batches/141-160]].
