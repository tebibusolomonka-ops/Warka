# Decisions

- Accessibility checks use axe-core on representative browser pages plus focused keyboard journeys. Automated scans are a gate for detectable violations, not proof of complete WCAG conformance. Workspace changes focus the main region and update a nonsensitive page title; background refreshes do not move focus.

- Legacy reporting backfill is explicitly unverified: it is the last recoverable stored state and cannot reconstruct overwritten attempts or an original checksum. Native versions retain checksums.
- Reporting reminder readiness reflects scheduler, outbox, and email provider state; disabled delivery is visible. Production startup validates core and enabled-feature configuration by name only. Deployment readiness uses ready, degraded, and blocked states instead of a score; migration preflight never applies repairs.

- Data quality evaluates facts without repairing source records or scoring schools. Duplicate candidate findings never merge students; missing re-enrollment is never dropout. Historical issued snapshots are validated as snapshots, never compared with mutable current student values. Reporting treats blank, unknown, not reported, and not applicable as distinct from numeric zero; readiness reports blockers and warnings and does not submit.

- Report submission is explicit and versioned. Resubmission requires a returned report and a reason; acceptance stores the exact version number. Bureau review may return or accept but cannot edit school aggregate values. Review notes append history, and internal notes never enter school reads. Regional validation uses factual codes without ranking, fraud labels, dropout inference, or quality scores. CSV exports use accepted aggregate versions only. Native versions retain verified snapshot checksums; a legacy backfill identifies only the last recoverable stored state, with no invented earlier attempts or historical checksum.

- School events use current school relationships for audience resolution; drafts stay private. Attachments require a clean current scan before publication or download. RSVP is an expressed intention, never evidence of attendance or a student engagement measure. Event location is a school label, with no participant location tracking.

- Family meeting requests require an authenticated guardian with a verified, unrevoked relationship to a currently enrolled child and an active teacher assignment for that child's class. Teacher availability contains school meeting windows only; it never reads a private calendar, personal contact details, or participant locations. Scheduling uses a serializable transaction and rejects overlapping teacher bookings. Rescheduling appends history instead of replacing prior times.

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
- Scheduled execution leases use generated process-instance identifiers, not host or network identity. Heartbeats extend only current ownership. Startup recovery is domain-specific: retention evaluation, backup verification, and file scanning can be retried under controlled rules; ambiguous email and interrupted backup or restore effects are never blindly replayed. Disaster-recovery readiness reports evidence and blockers without a score or guarantee.
- File keys are generated server-side and never sent to ordinary clients. Local development storage rejects traversal and symlinks; production object storage uses private objects. File access is checked against the current material, document, or branding relationship. Public document verification never grants PDF access. Artifact storage participates in issuance success and failed database writes trigger best-effort orphan cleanup.
- Malware scanning is asynchronous. The production adapter uses validated clamd TCP configuration; controlled browser tests use synthetic fixture bytes. Scanner unavailable never means clean. Quarantined assets cannot be downloaded by normal users, and operators can request a rescan or remove the artifact without a casual manual clean bypass.
- Search stays PostgreSQL backed at current scale, with no Elasticsearch cluster. Every query is role and school filtered before results are returned; references never grant access. Large text responses may be compressed, while PDF and other binary downloads retain their original stream. Only selected authenticated metadata uses private ETags; sensitive responses default to no-store.
- Transactional templates are server owned and render escaped text and HTML only in memory. SMTP credentials come from validated server configuration. Recovery tokens are derived from a server key and request ID, hashed at rest, and reconstructed only for delivery; outbox metadata contains no token. Only known safe provider failures retry, with a fixed attempt cap and backoff. Ambiguous SMTP outcomes require review.

See [[Security]] for the resulting invariants.

- Communication choices are per user and category. Account-security in-app notices cannot be disabled. Immediate email uses only selected event types and minimal template text; daily/weekly digests are opt-in and deduplicated by user/window.
- Email links use a validated Warka base URL and normal authentication. Self-service delivery history omits addresses, provider IDs, failure internals, and message bodies. Operations is limited to transactional delivery administration; arbitrary bulk sending is out of scope.
- Timetable conflicts are explicit blockers. Creation and publication do not move lessons automatically. Teacher and class collisions, expired assignments, and cross-school scope are checked before publication; archived versions retain their entries.
- Timetable conflicts never auto-resolve. Publication validates the draft, and published or archived versions remain historical records.
- Attendance does not infer absence from a missing record or a timetable entry. Every status is explicit and scoped to an approved enrollment.
- Submitted attendance requires every currently eligible student to be recorded. Finalized corrections require a school administrator, preserve the previous status, and create an audit event.
- Attendance summaries are factual counts only. They do not rank students or produce behavioral risk scores. Family history requires student identity or a verified, unrevoked guardian relationship and omits staff notes and correction reasons.
- Assessment schedules reuse existing definitions and never create marks. Class and room overlaps, capacity, inactive rooms, and invalid academic dates are blockers. Normal timetable overlap does not automatically block an assessment or move a lesson. Session opening validates the schedule again.
- Participation and marks are separate: absence and missing participation never imply a zero score. Make-up requests preserve the original participation and require explicit approval. Invigilation is a session duty, not permission to edit marks.
- Mark-entry windows are enforced by server time. Exceptional override requires an authorized reviewer, reason, and audit. Moderation retains the old mark and cannot edit a published result; published results use the existing correction workflow.
- A gradebook lock requires complete marks, closed entry windows, and resolved moderation. Locking differs from result submission and publication. Readiness reports blockers but never publishes. Academic progress summaries use published facts without ranking, prediction, or student risk scores.
- Coursework publication blocks until every active assignment attachment has a clean scan. Submission files may still be scanning at submission; the student's submittedAt is recorded immediately and scanner completion never changes it. Extensions apply per student. Coursework scores remain separate from official marks until an explicit transfer into the existing mark service. Transfer respects entry windows, gradebook locks, result state, and duplicate mark protection.
- Rubrics freeze after first scoring and scores retain versions. Plain-text feedback is private until release. Verified guardians have read-only coursework access. Factual counts never rank students or infer engagement, failure, or behavioral risk.

## Recovery and performance decisions

- Preserve interrupted executions and require evidence before replaying uncertain external effects.
- Report disaster recovery readiness as factual states and dates, never as a score or guarantee.
- Keep performance labels broad and exclude SQL, parameters, personal identifiers, and request identifiers.
- Use stable timestamp plus identifier pagination for changing lists while reapplying authorization scope on every page.
- Keep production load testing disabled unless an operator supplies the separate explicit override.
- Localize application-owned labels and controlled status displays through the shared catalogs. Preserve API codes and enum values. Do not automatically translate names, announcements, feedback, coursework instructions, meeting reasons, family messages, or other authored content.
- Use English fallback for unsupported locales and noncritical missing translations. Critical navigation, authentication, recovery, results, document, attendance, and reporting keys must exist in every supported catalog.
- Keep locale and calendar preferences independent. Ethiopic calendar rendering is presentation and input assistance rather than a certified civil calendar implementation; higher-risk dates include Gregorian context and canonical ISO values remain authoritative.

# Interoperability decisions

Spreadsheet formulas and executable transformations are rejected. Imports never merge likely duplicates automatically. Application requires the exact successful file, mapping, and transformation version. Exchange packages use a Warka-native format and do not claim unsupported external compatibility.

## Supply chain policy

- High and critical production dependency advisories fail `pnpm security:audit` unless an exact, reasoned, expiring exception exists.
- Missing package metadata is reported as unknown and needs a package-specific review note; it is not evidence of malicious behavior.
- CycloneDX 1.6 SBOMs are generated from the locked graph and kept as ephemeral build output.
- SHA-256 release checksums provide integrity evidence and are not digital signatures.

## Security hardening policy

## Deployment policy

- Run Prisma deployment migrations in a dedicated one-shot process before starting a release.
- Terminate TLS at the configured gateway, replace client forwarding headers, and trust only the configured internal proxy network.
- Keep runtime containers non-root and their root filesystems read-only; persist database, uploads, and backups outside disposable layers.
- Permit secret files only for an explicit key allowlist. Explicit environment values take precedence.
- Keep smoke checks read-only, explicit-target, and production-blocked unless the operator acknowledges the exact host.
- Never reverse database migrations automatically during application rollback. Compatibility metadata classifies rollback as eligible, review-required, or blocked.
- Prefer CSS responsive layout over viewport JavaScript. Keep critical table fields and accessible labels at every width.
- Low-bandwidth behavior is an explicit account preference. Network type may suggest it but never persists it automatically or changes authorization or domain results.
- Cache only public static shell assets. Never cache authenticated API responses or private downloads, and never claim full offline synchronization.
- Retry safe reads only. Treat failed mutations as result-unknown until refreshed. Resumable assembly still requires normal validation and malware scanning.

- Apply headers, origin checks, CSRF, body limits, proxy trust, and external URL validation in shared server boundaries.
- Rotate sessions after privileged authentication changes and preserve the HttpOnly cookie model.
- Treat the authorization matrix as regression metadata backed by real domain route tests; it does not replace resource checks.
- Report security posture as factual states and aggregate counts without scores, guarantees, secrets, or private event detail.

## Reliability checkpoint 461-470

Fault injection is instance scoped, deterministic, named, and rejected in production. Database, storage, scanner, provider, and worker failures preserve truthful state; expired safe work is retryable while ambiguous external effects require review. Transaction tests assert rollback rather than partial linked records. `pnpm data:verify` is read only and emits structured identifiers without record contents. Restore success requires migration, table, checksum, and invariant evidence against an isolated target. Historical upgrade fixtures are synthetic milestone samples; the upgrade matrix verifies only data that existed at each milestone. Commit 460 CI failed at `format:check` for six files; commit 461 repaired them.

## Release candidate checkpoint 480

The release-candidate profile uses strict security, private caching, isolated services, and deterministic test providers; production rejects test providers. Fictional canonical aliases drive identity, academic, coursework, document, reporting, and recovery acceptance. The upgrade matrix is upgrade-only, and `pnpm test:release-candidate` composes reliability, invariants, security, i18n, container, load, database-when-configured, and browser checks.

## Operations response milestone 490

Commit 481 repaired the mobile sign-in locator with an exact accessible label. Operational alert policies use bounded factual signals with warning and critical thresholds, lifecycle deduplication preserves acknowledgement separately from recovery, and transition routing avoids repeated notifications. Maintenance may suppress related availability notifications while readiness stays truthful; security and integrity alerts remain visible. Existing incidents now have controlled severity meanings, append-only typed timeline events, correction events, and evidence-based reviews that may retain an unknown root cause. Support escalation uses category, severity, elapsed time, impact, and configured support level. The operator-only Response workspace presents alerts, incidents, maintenance, reviews, and escalation actions without private school records.
