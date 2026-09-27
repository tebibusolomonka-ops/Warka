# Known issues

- Local PostgreSQL and Docker are unavailable in the current development environment. Clean migration deployment and database-backed journeys require CI or another PostgreSQL environment.
- Native PostgreSQL backup and restore tooling availability must be checked in the deployment environment.
- Scheduler and backup native-process deployment require an operator identity, configured storage, PostgreSQL connectivity, and PostgreSQL tools. The controlled browser adapter does not prove native dump or restore execution.
- File upload validation checks allowed types, content signatures, size, and safe names. Malware scanning is not yet integrated; the quarantine state is reserved for that boundary. Production object storage configuration and private bucket policy require deployment review.

Resolved prior validation failures are recorded in [[Batches/141-160]].
