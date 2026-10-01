# Security

Accessibility changes retain API authorization and relationship checks. Live-region messages remain brief and avoid student record details, credentials, and private status payloads; status text is visible without color. Deployment data remains operator-only despite a visible Operations section for eligible owners.

Recovery controls require the existing operator allowlist plus current organization-owner membership. Lease metadata uses a random process-instance identifier and contains no host, IP, task payload, or user identity. RecoveryReview permits only controlled domain resolutions and safe references; it excludes message bodies, recovery tokens, file contents, credentials, storage paths, and database URLs. Ambiguous email is not automatically resent.

Production configuration errors and deployment APIs expose only safe names and controlled states, never connection strings or credentials. Detailed deployment information requires the existing operator allowlist and current owner membership; school users cannot access it. Legacy report history labels unavailable provenance rather than implying verified historical evidence.

School data-quality issue detail and dismissal require current administrator membership; bureau reporting access does not grant student-level issue access. Issue summaries use bounded factual codes and minimal references. Checks do not modify student, enrollment, mark, or document records. Reporting readiness preserves blank versus zero and rejects blocking issues without submitting.

Reporting versions contain strict approved aggregates only, never student names or references. Snapshot checksums indicate integrity, not authentication. School routes return shared notes only; bureau-internal notes require scoped bureau access. Bureau review never writes school values. CSV exports read accepted aggregate snapshots, use formula-safe serialization, and create an audit event. No school ranking or performance score is produced.

Event management requires school administrator membership. Student, staff, and guardian event reads recheck audience against current school relationships; guardian writes require the verified linked child. Event detail exposes attachment availability only after a clean scan, and the download gateway rechecks asset and audience. RSVPs use authenticated identity, expose counts to school administration, and never create attendance or ranking records. No GPS or participant location tracking is present.

Guardian meeting requests derive guardian identity from the session and require a verified linked child plus a current teacher assignment for that child's class. Teacher availability is school-only. Meeting actions recheck teacher membership, schedule conflicts, and guardian relationship. History retains prior times and safe reasons; no personal calendar, phone number, private email, location tracking, or student engagement score is introduced.

Authorize every API and domain operation by actor and resource scope. Current account, membership, and assignment periods gate access. Student and guardian visibility follows explicit relationships; bureau and support access have separate boundaries.

Keep credentials and session tokens out of logs, audit metadata, notifications, and responses. Render user text as text. Do not place private student data in operational metadata. Audit privileged changes. Backup and restore must be operator-controlled and must never target the live database for rehearsal.

An operator must be explicitly allowlisted and have a current owner membership on an active account. Public health responses do not expose dependency details. Metrics labels contain routes rather than user, student, or request IDs. Operational alerts use neutral fixed text and deduplicate by recipient and event.

Never authorize a file by asset ID or possession alone. Learning files require current teaching control or eligible published-class access; guardian access follows the parent relationship. Issued PDF access requires the student or authorized issuing-school staff. Logos have a school administration boundary. Responses use private caching, safe download names, and no raw storage keys, bucket URLs, or credentials. Public verification exposes record status only.

Required file uploads stay inaccessible until their latest scan is clean. Infected assets become quarantined; scanner outage and failure never promote availability. Operators need both allowlisting and current owner access to inspect safe scan metadata or request rescan/removal. Notifications contain fixed neutral text and deduplicate by scan and recipient.

Search is authorization filtered and excludes credentials, sessions, family message bodies, and private security metadata. A public verification reference does not permit private search or opening. Search responses are bounded summaries and no-store; selected authenticated metadata uses user-specific private validators. Binary artifacts retain private no-store delivery without compression.

Outbound email records never contain SMTP credentials, raw recovery tokens, or full rendered bodies. Recovery responses remain neutral, tokens expire and are single use, and the hash alone is persisted. Operator-only delivery lists mask addresses and expose controlled failure codes. A successful delivery is not resent; uncertain provider outcomes are not automatically retried.
Notification email contains only a neutral update and authenticated application link. The API derives preference and delivery ownership from the session; account-security in-app notices remain mandatory. Digest scheduling cannot mix users or resend the same window. Controlled email inspection endpoints are enabled only in test mode with explicit flags.
Attendance writes require current school administrator authority or an active teaching assignment for the exact class and session subject. Submitted records cannot be bulk overwritten; finalized corrections require an administrator and audit trail. Family routes derive the student or verified guardian relationship from the signed-in user, return finalized status only, and omit staff notes. Missing attendance is never presented as absence or a behavioral score.
Assessment administrators manage schedules and make-up review; teachers need a current exact class/subject assignment. Invigilators receive only session-specific operational access, never mark-edit rights. New invigilator assignments require an active account, effective school membership, and no overlapping duty. Assessment participation requires approved enrollment and is never converted into a mark or automatic zero.
Gradebook staff routes require current school membership and an exact active teaching assignment for teachers. Reviewer and administrator transitions remain separate. Entry windows, locks, and published-result state are server-checked; moderation cannot bypass correction history. Student summaries require the student's linked account, and guardian summaries require a verified eligible child relationship with school scope. Neither route exposes classmates, rankings, predictions, or risk labels.
Coursework staff actions require current school and class/subject authority. Student assignment and submission routes derive identity from the signed-in account and current eligible enrollment; no client student ID controls student writes. Assignment files require publication and clean scans; teacher access to submission files requires a submitted revision and clean scan. Quarantined files remain unavailable. Draft and removed attachments never grant download access. Plain-text instructions and responses reject HTML.
Guardian coursework reads reuse verified child and current enrollment checks; no guardian mutation route exists. Draft feedback and rubric scores stay private until release, and attachment metadata is excluded from the guardian response. Mark transfer is an explicit staff action into the existing Mark service and cannot overwrite a mark or bypass an entry window, gradebook lock, or published result. Coursework notices carry neutral text and follow the learning-material notification preference and digest rules.

## Localization boundaries

Locale and calendar preferences do not grant access or change authorization queries. Public recovery remains account-enumeration neutral in every supported locale. Tokens, addresses, identifiers, resource references, API codes, stored enum values, and authored user content are not translated. Catalog strings render as text and HTML markup is rejected by the repository translation check.

## Recovery and performance data boundaries

Recovery records store controlled reason codes and safe references, never email bodies, tokens, file contents, credentials, storage paths, or database URLs. Performance metrics use broad route and query categories and exclude raw SQL, parameters, personal identifiers, request identifiers, and employee or school rankings. Load credentials remain environment supplied, synthetic fixture IDs are required, and production targets are blocked without a separate override.

# Interoperability boundaries

External IDs are private scoped aliases and never authentication or merge keys. Bulk import/export requires school or organization administration. Dry runs cannot create domain records. Formula execution, macros, arbitrary code, traversal paths, storage keys, credentials, security records, and unrelated private data are excluded.

## CI and software supply chain

The CI workflow must cover source pushes to `main`, pin external actions to immutable SHAs, and retain explicit read-only GitHub token permissions. `pnpm security:audit` rejects undocumented high or critical advisories. Exceptions identify the package and advisory, explain reachability, state review context, and expire. Dependency metadata exceptions are package-specific. SBOM output uses CycloneDX 1.6 and frozen lockfile input. Supply chain status is restricted to configured Operations owners and contains only safe aggregate metadata.

# Deployment boundary

Caddy is the public TLS boundary and replaces inbound forwarding headers before requests reach the API. PostgreSQL and application containers are not published. Secret-file loading is limited to approved sensitive keys and never sends those values to the browser or logs them.

Deployment APIs are read-only and Operations-only. They expose safe release and health facts without registry credentials, secret files, database URLs, or arbitrary command execution.

Low-bandwidth mode changes only optional request frequency and size. It never bypasses authorization, security checks, or official calculations, and network hints are not stored as user tracking data.

Upload ownership and school scope are checked independently of the session identifier. Range handling follows authorization and clean-file checks. Service-worker matching excludes API and download routes.

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
