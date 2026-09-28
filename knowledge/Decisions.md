# Decisions

- Authentication uses HttpOnly database sessions, with no localStorage authentication token.
- `Student` and `Guardian` are separate from `User`; login access does not replace domain relationships.
- Published results and issued documents are snapshots. Corrections create traceable transitions rather than silently editing history.
- Transfers use an explicit source/destination workflow.
- Bureau permissions are dedicated; support access is temporary and scoped.
- Retention evaluation is non-destructive. Personal record corrections require controlled review.
- Account, membership, and teaching assignment lifecycle periods all affect current access.
- Infrastructure operations require both an explicit operator allowlist and current organization owner access. Backup artifacts stay outside PostgreSQL, and restore rehearsals use generated isolated databases.
- Production backup and restore use native PostgreSQL processes with fixed arguments. Browser tests use an explicit test-only adapter; this is not evidence of a native restore. Operational metrics use route patterns without person or request identifiers as labels.
- Scheduled operations use a PostgreSQL advisory lock and unique retry series. Retries have a fixed attempt cap and backoff. Backup artifact retention is operational storage cleanup with preserved record history; it is separate from personal-data retention evaluation, which never deletes records.
- File keys are generated server-side and never sent to ordinary clients. Local development storage rejects traversal and symlinks; production object storage uses private objects. File access is checked against the current material, document, or branding relationship. Public document verification never grants PDF access. Artifact storage participates in issuance success and failed database writes trigger best-effort orphan cleanup.
- Malware scanning is asynchronous. The production adapter uses validated clamd TCP configuration; controlled browser tests use synthetic fixture bytes. Scanner unavailable never means clean. Quarantined assets cannot be downloaded by normal users, and operators can request a rescan or remove the artifact without a casual manual clean bypass.
- Search stays PostgreSQL backed at current scale, with no Elasticsearch cluster. Every query is role and school filtered before results are returned; references never grant access. Large text responses may be compressed, while PDF and other binary downloads retain their original stream. Only selected authenticated metadata uses private ETags; sensitive responses default to no-store.
- Transactional templates are server owned and render escaped text and HTML only in memory. SMTP credentials come from validated server configuration. Recovery tokens are derived from a server key and request ID, hashed at rest, and reconstructed only for delivery; outbox metadata contains no token. Only known safe provider failures retry, with a fixed attempt cap and backoff. Ambiguous SMTP outcomes require review.

See [[Security]] for the resulting invariants.
- Communication choices are per user and category. Account-security in-app notices cannot be disabled. Immediate email uses only selected event types and minimal template text; daily/weekly digests are opt-in and deduplicated by user/window.
- Email links use a validated Warka base URL and normal authentication. Self-service delivery history omits addresses, provider IDs, failure internals, and message bodies. Operations is limited to transactional delivery administration; arbitrary bulk sending is out of scope.
- Timetable conflicts are explicit blockers. Creation and publication do not move lessons automatically. Teacher and class collisions, expired assignments, and cross-school scope are checked before publication; archived versions retain their entries.
