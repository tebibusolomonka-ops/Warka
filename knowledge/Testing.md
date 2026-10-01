# Testing

The accessibility Playwright helper runs axe-core WCAG A/AA scans on sign-in, student, guardian, school administration, bureau, family meeting, and Operations screens. Focused journeys check skip navigation, form error focus and association, dialog focus restoration, search keyboard access, route title and focus, and reduced motion. Manual assistive technology review remains necessary.

Recovery tests use controlled clocks for lease expiry and heartbeat extension. Scheduler tests assert that ownership loss prevents successful completion, startup reconciliation selects domain-specific transitions, ambiguous email is held without resend, and stale scanning never promotes an asset to clean. The Recovery API and workspace tests cover operator authorization and safe projections; PostgreSQL and browser execution remain CI checks locally.

Deployment tests cover production configuration, profiles, bounded shutdown ordering, safe build fields, migration history classification, readiness reasons, operator API access, and React status. The focused Operations Playwright journey checks deployment metadata and denies school administrator access. Local discovery is distinct from a live PostgreSQL browser run.

`pnpm db:preflight` validates the Prisma schema and inspects migration status without applying or repairing migrations. It reports ready, pending, failed migration, divergence, or unavailable using safe status labels. Run it after migration deployment and before application rollout; a missing local PostgreSQL service reports unavailable.

Data quality unit checks cover student, academic, document, run reconciliation, API scope, and React controls. PostgreSQL tests cover issue persistence and enrollment consistency; they skip locally without a server. Reporting validation tests cover blank/unknown values, aggregate totals, open blockers, and non-submitting readiness. Final CI must confirm migrations and live database behavior.

Reporting tests cover version persistence, explicit resubmission, review authorization, append-only note visibility, canonical checksum stability, regional issue codes, safe accepted-only CSV, notification deduplication, and React controls. The Playwright reporting journeys cover return/correction/resubmission/acceptance with preserved versions and a blocked unknown aggregate. Local discovery is not live browser execution.

The final family meeting journey checks guardian request, teacher scheduling, guardian status/history, and unrelated guardian rejection. The school event journey checks administrator publication, guardian visibility, RSVP aggregate, cross-school denial, and that RSVP does not create attendance. Coursework browser coverage remains in `tests/e2e/courseworkJourney.spec.ts`. Live execution of these journeys requires PostgreSQL; Playwright discovery by itself is not a pass.

Coursework mark transfer now has a PostgreSQL integration test for successful official mark creation, conversion provenance, closed entry windows, gradebook locks, duplicate marks, school and teacher boundaries, published results, and transaction rollback after a fault at transfer persistence. This test skips locally without PostgreSQL. Family meeting database tests cover verified guardian requests, class assignment scope, scheduling conflict, and retained reschedule history. API tests cover signed-in identity, teacher-scoped lists, and rejection of guardian ID spoofing; React tests cover teacher meeting controls. `pnpm metrics:code` is the canonical implementation count.

Vitest covers web, API, authentication, database services, and permission boundaries. PostgreSQL integration tests require a disposable database. Playwright covers synthetic browser journeys with cleanup. CI runs the database-backed checks that this local environment cannot run.

During a batch, run focused tests, TypeScript checks, and relevant schema checks per commit. Run full unit, database integration, browser, lint, format, typecheck, build, and Prisma validation at the final batch commit. Never present discovery or mocked process tests as a live PostgreSQL backup or restore.

The operations browser journey uses a test-only adapter behind `NODE_ENV=test` and an explicit enable flag. It writes an artifact and exercises metadata transitions; native `pg_dump`, archive inspection, and restore process boundaries are tested separately with injected process adapters.

The scheduler browser journey uses an explicit test-only tick and failure adapter. It exercises database-coordinated execution, verification, retry history, and authorization without wall-clock waiting. Native backup processes remain a separate boundary.

File tests cover storage key confinement, object adapter calls, signature validation, scoped authorization, upload failures, document checksums, and private delivery headers. Browser journeys cover teacher upload, student download, unrelated-student denial, branding, and issued document delivery with a dedicated local test storage root. Live PostgreSQL browser execution remains CI dependent.

Scan tests use a fake scanner for controlled clean, infected, failed, and unavailable results. Browser tests use a synthetic marker fixture and test-only scanner configuration; no real malware or ClamAV daemon is required. PostgreSQL-backed scan journeys remain CI dependent locally.

Search tests cover bounded parameters, school/role scope, summary fields, result opening, and per-user rate limiting. React tests cover grouped text rendering, keyboard opening, and deferred requests. Compression tests cover large JSON, small responses, binary and stream exclusions; cache tests cover 304, changed resources, user context, and no-store. The extended browser journey covers school isolation and student, document, and support search when CI provides PostgreSQL.

Email tests use an in-memory provider or injected SMTP transport. Targeted tests cover validated configuration, escaped templates, delivery claims, bounded retry, neutral recovery responses, operator authorization, and masked administration status. PostgreSQL email migration and recovery integration tests skip locally without a database.
Communication route tests verify identity-scoped preferences and paginated delivery history. Browser journeys use a test-only in-memory email provider and controlled outbox tick to exercise recovery email, protected notification links, digest deduplication, and cross-user history denial when PostgreSQL is available.
Timetable tests cover conflict codes, assignment scope, administrator and teacher API boundaries, React publication controls, and a browser journey with a teacher double-booking attempt. Database-backed timetable tests and Playwright execution require PostgreSQL; local discovery alone does not prove the journey.
Attendance tests cover assignment and school authorization, duplicate and invalid enrollment prevention, explicit bulk capture, submission completeness, correction history, family history boundaries, and factual summaries. The Playwright journey captures mixed statuses, checks cross-class denial, finalizes, and verifies student history when a dedicated PostgreSQL database is available.
Assessment tests cover room and time input, exact definition context, class/room/capacity conflict issues, explicit participation, make-up transitions, expired invigilator access, API authorization, and React conflict display. The Playwright journey exercises scheduling, session participation, and make-up review against CI PostgreSQL; local discovery alone is not execution.
Gradebook tests cover window enforcement, completeness states, moderation history, lock authorization, readiness blockers, API assignment scope, and React status distinctions. The browser journey covers teacher entry, explicit missing and zero states, reviewer approval, retained correction history, lock/readiness, and an unrelated teacher denial. Local Playwright discovery is not browser execution.
Coursework unit and API tests cover current enrollment audience, teacher scope, publication scan blockers, submission ownership and revision history, personal extensions, file access, and teacher React counts/actions. A PostgreSQL integration test covers both assignment and submission attachment scan gates and stable submittedAt; it skips without a local test database.
Later coursework tests cover review, versioned rubric scoring, feedback release, explicit mark-transfer gates, guardian read-only data, notification preferences, and factual summaries. The Playwright journey exercises safe files, review, feedback, mark entry window and lock blocks, official transfer, unrelated-role denials, and quarantine when PostgreSQL is available. Local Playwright discovery does not prove execution.

## Canonical implementation metrics

Run `pnpm metrics:code` for the committed `HEAD`, or `pnpm metrics:code <revision>` for a historical commit. The repository-owned utility reads Git tree blobs, so only committed tracked files are counted. It includes files under `apps/`, `packages/`, and `scripts/` with `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.css`, `.scss`, `.sql`, or `.prisma` extensions. It excludes test/spec files, `__tests__`, `__mocks__`, generated/vendor folders, `node_modules`, `dist`, `build`, `coverage`, `.next`, and `.turbo`. This includes production TypeScript and TSX, JavaScript utilities, CSS, Prisma schema, and SQL migrations; it excludes documentation, knowledge notes, test implementation, root tooling configuration, and local files. LOC counts lines containing any non-whitespace character. The baseline at commit 300 (`98a2a9c`) is **453 implementation files and 59,114 nonempty implementation LOC**. Earlier LOC reports used incompatible methods and should not be compared with this baseline.

## Load reliability

`pnpm test:load` runs the repository owned autocannon harness. It requires `WARKA_LOAD_TARGET`, `WARKA_LOAD_ENV`, and a matching `WARKA_LOAD_ACK`; production targets also require `WARKA_ALLOW_PRODUCTION_LOAD=true`. Authentication comes from `WARKA_LOAD_COOKIE`, and scenario identifiers must refer to seeded synthetic fixtures.

The `representativeReads` profile covers portal and notification reads, student search, teacher gradebook, attendance roster, and reporting dashboard paths. It sends read requests only and reports throughput, p50/p95/p99 latency, errors, and timeouts. Results are written to standard output for ephemeral CI or operator capture and are not committed. These measurements describe the tested environment and are not universal service level guarantees.

## Reliability regression gates

Deterministic tests assert bounded notification and attendance query structure instead of wall-clock timing. The final browser journey verifies the safe Performance view for an operator and denial for a school administrator. Normal CI runs `pnpm test:load:config`; sustained load requires an explicitly acknowledged external target.

## Localization regression gates

Run `pnpm i18n:check` for locale identifiers, duplicate keys, critical coverage, placeholder parity, unknown keys, and HTML markup. Unit tests cover fallback, interpolation, locale formatting, Ethiopic boundaries, and preference independence. Focused Playwright journeys cover persisted language choice, authored-content preservation, recovery neutrality, keyboard navigation, and canonical-date preservation.

# Interoperability verification

Tests cover clean scanned XLSX parsing and resource limits, approved mapping targets, deterministic transformations, dry-run write boundaries, exact-version application, idempotency, manifest checksums, path safety, exclusions, and representative authorization boundaries.

## Supply chain validation

Use `pnpm ci:check`, `pnpm install:check`, `pnpm security:dependencies`, `pnpm security:sbom`, and `pnpm security:check`. CI installs with `--frozen-lockfile`; the combined security command is non-mutating and includes secret patterns, dependency audit, metadata, SBOM, workflow policy, and release checksum validation.

## Security hardening validation

Unit and route tests cover response headers, trusted origins, session-bound CSRF, privileged session rotation, proxy parsing, outbound URL rejection, request limits, authorization boundaries, and safe posture projection. `tests/e2e/securityHardening.spec.ts` verifies hardened headers, untrusted-origin rejection, CSRF denial, authentication requirements, and response secrecy against the running API. A local discovery run is not equivalent to execution with PostgreSQL.

# Deployment validation

`pnpm container:check` validates image and topology policy statically. `pnpm deployment:smoke` requires `WARKA_SMOKE_TARGET`; non-local targets also require an explicit production override and exact expected host. Docker Compose and Caddy validation run when a local Docker engine is available.

CI builds both runtime images, validates Compose and Caddy, checks release and manifest consistency, and rehearses rollout and rollback policy with synthetic dry runs. Focused Operations tests verify the operator boundary.

Responsive component tests cover semantic layouts, mobile navigation focus, tables, touch targets, forms, network state, and request policy. Playwright discovers a narrow viewport journey without relying on screenshots.

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
