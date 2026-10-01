# Architecture

Major React screens use one main landmark, named navigation, skip links, and focus on workspace changes. Shared form errors, dialogs, and async status components provide programmatic announcements; styling respects reduced motion.

Scheduled work uses process-instance identifiers, expiring execution leases, and bounded heartbeats. Startup reconciliation runs before scheduler claims and applies domain-specific recovery: safe work becomes eligible for controlled retry, ambiguous external effects require reconciliation, and unsafe work requires manual review. RecoveryReview records hold safe references and controlled resolutions. Operations shows factual recovery and disaster-recovery evidence without promising that recovery will succeed.

Deployment startup validates production configuration and resolves an explicit development, test, or production profile. Signal handling stops scheduler claims before server close and bounds the drain. The operator-only Deployment API joins safe build metadata, dependency and migration readiness, and feature switches; the React Operations workspace displays these states.

Data-quality checks read current school records and return factual codes. Evaluation runs reconcile open issue history without changing underlying records. School administrator routes and workspace expose filtered issues and existing correction destinations. Reporting readiness validates existing bureau reporting periods and approved aggregates before explicit submission.

School events use a separate draft/published/completed lifecycle from announcements. Fastify event routes derive school, audience, student, and verified guardian scope from current relationships. School administrators manage events in React; student and guardian portals show only eligible published events. Event attachments reuse FileAsset storage, scanning, quarantine, and private delivery. RSVP persistence and aggregate counts are separate from attendance.

Family meetings use PostgreSQL requests, school-only teacher availability, scheduled slots, and append-only events. Guardian and teacher routes recheck current relationships; the teacher workspace sits with academic tools. No personal calendar service or location tracking is connected.

- `apps/web`: React workspaces and typed API clients; controls aid users but do not grant access.
- `apps/api`: Fastify routes, request validation, application services, audit and notification orchestration.
- `packages/shared`: cross-boundary contracts. `packages/database`: Prisma schema, migrations, repositories, and transactional domain operations. `packages/auth`: credentials and database-backed sessions.
- Authentication uses HttpOnly cookies; API and domain services enforce authorization. School, organization, student, guardian, bureau, and temporary support scopes are distinct.
- Student and guardian portals use their own relationship checks. Bureau access has dedicated authorization. Support access is temporary and school-scoped.
- Notifications are persisted and scoped to recipients. Documents and published results use issued snapshots. Reporting uses named exports and scoped views. Governance includes review workflows, privacy requests, correction routing, retention holds, and non-destructive evaluation.
- Whole-database backup metadata lives in PostgreSQL; archive bytes live behind a storage adapter. The local adapter uses a configured filesystem directory. Backup, verification, and isolated restore rehearsal run through PostgreSQL native tools with controlled arguments.
- The API process polls enabled backup and retention policies without a browser. A dedicated PostgreSQL advisory lock coordinates instances. Scheduled executions persist attempts and safe outcomes; backup verification and artifact retention run through the existing services. Personal-data retention evaluation remains aggregate and non-destructive.
- `FileAsset` records hold metadata and scope only. File bytes use a server-side storage interface with a confined local development adapter or private S3-compatible object storage. Purpose-bound API routes authorize and stream learning materials, current school logos, and issued PDF artifacts. Immutable document snapshots identify the branding asset used at issuance.
- `/health` is liveness; `/ready` exposes only a readiness result. Detailed dependency state, backup and rehearsal summaries, incidents, maintenance, and HTTP metrics are available through operator-only APIs and the React Operations workspace. Request logs record route patterns and bounded correlation IDs without headers or bodies.
- Required file scans are queued with scheduled executions and coordinated by the PostgreSQL scheduler lock. The scanner interface has a ClamAV production adapter and a test-only deterministic adapter. The scan worker controls asset availability; operator APIs expose safe scan metadata, health, and quarantine actions.
- Search uses authorized PostgreSQL queries for school scoped students, staff, documents, transfers, and support; operators can search incidents. The React shell requests bounded summaries after a debounce and opens selected resources through a separately authorized route. Fastify compresses sizable text responses while binary streams bypass compression. Selected authenticated metadata uses private conditional validators.
- Transactional email uses persistent delivery records and scheduled executions. The provider interface separates a production SMTP adapter from a deterministic test provider. The database scheduler lock coordinates claims; operator-only APIs expose safe delivery status and restricted retries.

See [[DomainModel]], [[Decisions]], and [[Security]].

Reporting now stores one aggregate-only snapshot per school submission attempt. Fastify routes separate prepare, submit, resubmit, bureau review, notes, validation, and scoped CSV exports; React presents the same boundaries. The email outbox scheduler plans deduplicated deadline notices before routing preference-aware notification email. See [[Batches/321-340]].
Notification email routing reads selected in-app events without copying their private contents into messages. User preferences select immediate email or daily/weekly digest for supported categories; the scheduler stores one digest per user/window. Email links point to the authenticated Warka app. Self-service delivery history is limited to the signed-in user and safe status fields.
Timetable configuration uses school calendar days, reusable periods, and versioned class timetables. The API enforces school administrator edits and active-assignment teacher reads; published versions drive teacher views, while drafts and archived versions remain distinct.
Attendance services use explicit sessions, enrollment-scoped records, transactional bulk capture, and append-only corrections. Fastify routes enforce active class assignments or school administrator scope; student and guardian histories are derived from identity and verified links. React workspaces expose teacher capture and family-safe finalized history.
Assessment scheduling references existing `Assessment` definitions. School-scoped rooms, schedules, and operational sessions are distinct. Fastify validates conflicts before scheduling and again before opening; administrator and exact-assignment staff routes support the React assessment calendar.
Gradebook services enforce mark-entry windows, completeness, moderation, locking, and publication readiness in the database layer. Scoped Fastify routes feed the staff workspace; student and guardian progress summaries derive from published results and explicit assessment activity.
Coursework uses separate assignment, audience, submission, revision, extension, and attachment services. Fastify exposes explicit staff and student actions; the teacher React workspace consumes scoped routes. Both attachment types use the shared FileAsset scanner and private delivery gateway.
Rubric scoring, controlled feedback release, and an explicit transactional transfer to the existing Mark service extend coursework without creating another official grade store. The student and guardian portals use scoped read paths; guardian writes are absent. Coursework events use existing notification preferences and digest routing.

## Recovery and performance reliability

Scheduled work uses database leases with bounded heartbeats and domain-specific startup reconciliation. Ownership loss creates an interrupted state; only work classified safe to retry can be replayed. External effects with uncertain outcomes enter reconciliation or manual review.

API observability aggregates normalized route categories and query operation categories. Performance budgets warn without rejecting domain work. Interactive and background HTTP timeouts are separate, file streams are exempt, and Prisma pool limits are validated before client creation. The repository load harness is explicit-target, synthetic-data, read-only by default, and production-blocked by default.

## Localization

`@warka/shared` owns locale selection, the `en`, `am`, and `om` catalogs, interpolation, locale formatting, Ethiopic calendar display, and deterministic catalog validation. React surfaces consume this shared layer. English is the fallback for unsupported locales and lower-priority missing translations. User language and calendar choices are separate persisted preferences. Canonical timestamps and numeric values cross API and database boundaries unchanged.

# Interoperability architecture

Controlled imports progress through scanned parsing, strict mapping, deterministic transformation, immutable dry run, and transactional exact-version application. Warka exchange packages are structured, versioned manifests with per-file checksums rather than database dumps.

## Supply chain controls (commit 410)

The main CI workflow covers pushes to `main` and pull requests, uses immutable action revisions, read-only token permissions, frozen pnpm installs, and a repository-owned policy check. Operations users can read only validated build and CI status through `/operations/supply-chain`; dependency internals and credentials are not exposed.

## Application security controls

Fastify applies security headers, an allowlisted origin policy, session-bound CSRF validation, bounded request sizes, explicit proxy trust, and validated external URL rules at shared boundaries. Privileged authentication rotates sessions. The operator Security view combines controlled configuration facts with aggregate blocked-login and quarantined-file counts; it exposes no credentials, tokens, dependency graph, or private record details.

## Production hosting

Production uses separate non-root API and static-web images behind Caddy. The provider-neutral single-host Compose reference keeps PostgreSQL private and persistent data in named volumes. API startup, migrations, and deployment smoke checks are separate bounded processes. Approved secrets may be injected through files; `singleHost` and `managedServices` select configuration requirements without changing application code.

One semantic version feeds API/browser build metadata and OCI labels. Machine-readable manifests, deployment history, health gates, and controlled rollout and rollback tools form the release path.

Responsive CSS primitives provide fluid containers, stacks, grids, sidebars, toolbars, forms, and semantic tables. Mobile navigation renders the same authorized link model as desktop. Browser online state and API reachability remain separate signals.

The PWA boundary caches only named static shell assets. Upload sessions keep metadata in PostgreSQL and chunks in storage; assembly returns to the existing FileAsset validation and scanning lifecycle. Range delivery is applied only after authorization.

## Reliability checkpoint 461-470

Fault injection is instance scoped, deterministic, named, and rejected in production. Database, storage, scanner, provider, and worker failures preserve truthful state; expired safe work is retryable while ambiguous external effects require review. Transaction tests assert rollback rather than partial linked records. `pnpm data:verify` is read only and emits structured identifiers without record contents. Restore success requires migration, table, checksum, and invariant evidence against an isolated target. Historical upgrade fixtures are synthetic milestone samples; the upgrade matrix verifies only data that existed at each milestone. Commit 460 CI failed at `format:check` for six files; commit 461 repaired them.

## Release candidate checkpoint 480

The release-candidate profile uses strict security, private caching, isolated services, and deterministic test providers; production rejects test providers. Fictional canonical aliases drive identity, academic, coursework, document, reporting, and recovery acceptance. The upgrade matrix is upgrade-only, and `pnpm test:release-candidate` composes reliability, invariants, security, i18n, container, load, database-when-configured, and browser checks.

## Operations response milestone 490

Commit 481 repaired the mobile sign-in locator with an exact accessible label. Operational alert policies use bounded factual signals with warning and critical thresholds, lifecycle deduplication preserves acknowledgement separately from recovery, and transition routing avoids repeated notifications. Maintenance may suppress related availability notifications while readiness stays truthful; security and integrity alerts remain visible. Existing incidents now have controlled severity meanings, append-only typed timeline events, correction events, and evidence-based reviews that may retain an unknown root cause. Support escalation uses category, severity, elapsed time, impact, and configured support level. The operator-only Response workspace presents alerts, incidents, maintenance, reviews, and escalation actions without private school records.

## Pre-release evidence milestone 499

`pnpm readiness:check` reports required blockers, warnings, and unavailable evidence without a score or mutation. Recovery and incident drills require non-production targets and emit safe structured plans. `pnpm acceptance:check` maps critical capabilities to real repository evidence and retains partial or not-covered states. Pilot rollout stores factual prerequisites, explicit states, and append-only transitions; readiness never activates a school automatically. Nine validated runbooks reference repository commands and explicit stop conditions. `pnpm release:audit` composes existing policy, security, localization, container, deployment, acceptance, runbook, readiness, release-candidate, invariant, and historical-upgrade checks into safe machine-readable evidence.

## Warka 500-commit release-readiness milestone

Warka's planned implementation sequence ends with repository-owned operational evidence, selected historical upgrade coverage, controlled pilot rollout, validated runbooks, and a composable release audit. These controls report facts and limitations; they do not constitute external certification, professional accessibility review, penetration testing, or live-provider acceptance. Future work remains optional environment integration and evidence refresh rather than an implied completed certification.
