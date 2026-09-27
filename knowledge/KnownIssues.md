# Known issues

- Local PostgreSQL and Docker are unavailable in the current development environment. Clean migration deployment and database-backed journeys require CI or another PostgreSQL environment.
- Native PostgreSQL backup and restore tooling availability must be checked in the deployment environment.
- Scheduler and backup native-process deployment require an operator identity, configured storage, PostgreSQL connectivity, and PostgreSQL tools. The controlled browser adapter does not prove native dump or restore execution.
- File upload validation checks allowed types, content signatures, size, and safe names. Production ClamAV availability, scheduler configuration, object storage configuration, and private bucket policy require deployment review. A failed scanner leaves required files pending; operational follow-up is needed.
- Search currently relies on PostgreSQL and per-process authenticated rate limiting; a shared gateway limit may be needed at larger scale. Full offline synchronization is not implemented. Local PostgreSQL and browser execution remain unavailable in this environment.
- Outbound email remains disabled until operators supply validated SMTP settings, a stable recovery derivation key, and the public application URL. Local PostgreSQL and SMTP services are unavailable, so outbox persistence and real delivery require CI or deployment validation. Ambiguous SMTP outcomes are held for operator review rather than automatically resent.

Resolved prior validation failures are recorded in [[Batches/141-160]].
