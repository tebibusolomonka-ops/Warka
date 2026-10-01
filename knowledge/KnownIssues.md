# Known issues

- Automated axe-core scans and keyboard journeys do not replace manual screen-reader testing. Local PostgreSQL is unavailable for live authenticated browser execution; CI must validate the final journeys.

- Reporting attempts overwritten before versioning cannot be reconstructed. A legacy backfill contains only the last stored state and has no original checksum.
- Local PostgreSQL remains unavailable. Migration preflight reports databaseUnavailable locally; deployment readiness and the browser journey need CI PostgreSQL confirmation. Forced-shutdown work is now detected through expired leases and domain-specific startup reconciliation. External effects remain inherently ambiguous: unknown email provider outcomes, interrupted backup creation, and restore rehearsals still require verification or operator review and are never blindly replayed.

- PostgreSQL is unavailable locally for this batch; new data-quality migration and integration tests require CI execution. Quality checks currently use bounded school queries without background scheduling configuration; scheduled invocation can use the existing scheduler. Reporting window fields are optional for historical periods, which continue to use their existing due date.

- Local PostgreSQL and Docker are unavailable for this batch. Family meeting and school event Playwright discovery can run locally, but live browser behavior, migration deployment, and real database integration need CI. Event upload uses the shared scanner; production ClamAV and private storage remain deployment checks. Event lists currently cap at 100 rows and do not expose pagination.

- Real PostgreSQL coursework mark-transfer and family meeting integration tests are present, but local execution remains unavailable because no PostgreSQL server is listening on `127.0.0.1:5432`. Coursework Playwright discovery passed; live execution remains a final CI check. Teacher meeting windows are school-only and do not integrate with personal calendars or create online meetings.

- Local PostgreSQL and Docker are unavailable in the current development environment. Clean migration deployment and database-backed journeys require CI or another PostgreSQL environment.
- Native PostgreSQL backup and restore tooling availability must be checked in the deployment environment.
- Scheduler and backup native-process deployment require an operator identity, configured storage, PostgreSQL connectivity, and PostgreSQL tools. The controlled browser adapter does not prove native dump or restore execution.
- File upload validation checks allowed types, content signatures, size, and safe names. Production ClamAV availability, scheduler configuration, object storage configuration, and private bucket policy require deployment review. A failed scanner leaves required files pending; operational follow-up is needed.
- Search currently relies on PostgreSQL and per-process authenticated rate limiting; a shared gateway limit may be needed at larger scale. Full offline synchronization is not implemented. Local PostgreSQL and browser execution remain unavailable in this environment.
- Outbound email remains disabled until operators supply validated SMTP settings, a stable recovery derivation key, and the public application URL. Local PostgreSQL and SMTP services are unavailable, so outbox persistence and real delivery require CI or deployment validation. Ambiguous SMTP outcomes are held for operator review rather than automatically resent.

Resolved prior validation failures are recorded in [[Batches/141-160]].

- Local PostgreSQL is unavailable for live browser journeys; Playwright discovery is local, while execution depends on CI or a dedicated PostgreSQL service. SMTP delivery and production configuration remain deployment checks.
- Commit 241 corrected the FileScan test teardown order without weakening the production foreign key. Local PostgreSQL remains unavailable, so the live integration test and CI confirmation are pending final validation.
- Attendance summaries use currently approved class enrollments when calculating unrecorded counts for historical sessions. Enrollment changes can alter that historical denominator; a future roster snapshot would make it immutable.
- Local PostgreSQL and browser execution remain unavailable for attendance journeys; CI must run migrations and the database-backed tests.
- Assessment migrations, PostgreSQL integration tests, and the live browser journey require CI because local PostgreSQL is unavailable. Assessment session completion currently records lifecycle state; a separate gradebook workflow controls marks and results.
- Gradebook migrations and the final browser journey also require CI PostgreSQL. The staff workspace reuses existing academic filters and result submission; readiness is advisory and does not publish. Progress counts completed present participation and currently authorized published results, not a new grading calculation.
- Coursework PostgreSQL integration tests and live browser journeys skip locally without a database. Teacher counts use current approved class enrollment, so historical denominators can change with enrollment. The teacher workspace currently lists up to one page of assignments; pagination is available in the API.
- Coursework mark-transfer tests cover service gates with mocks locally; live PostgreSQL and Playwright execution require a dedicated database. Browser coverage uses a controlled scanner fixture, so production ClamAV and object storage need deployment validation. Class summary denominators follow current approved enrollment and can change historically.

# Reporting batch notes

Local PostgreSQL and Docker are unavailable, so migration deployment, database integration, and live Playwright journeys await CI. Legacy reporting submissions are backfilled as version 1 from their last stored snapshot; older overwritten attempts cannot be reconstructed, and those backfilled versions have no checksum. Scheduled reporting reminders run with the enabled email outbox scheduler; deployments with that scheduler disabled do not send them.

## Remaining recovery and performance limits

Forced shutdown can still leave external side effects whose outcome cannot be inferred. Warka now records these as interrupted or unknown and requires reconciliation or controlled operator review; it does not guarantee automatic recovery. Local performance results depend on fixtures, hardware, and deployment topology. The load profiles provide comparative evidence and do not establish universal service levels.

## Localization limits

Amharic and Afaan Oromo catalogs have engineering review only; they have not received professional linguistic certification. Ethiopic calendar display uses the platform `Intl` implementation and is not presented as government-certified conversion.

# Interoperability limitations

XLSX formulas and macros are intentionally unsupported. Exchange packages implement only Warka `studentTransferPackage` version 1.0. Import duplicate findings require staff review and are not resolved automatically.

## Dependency review items

Prisma's optional CLI graph currently carries time-limited exceptions for `effect` GHSA-38f7-945m-qr2g and `deepmerge-ts` GHSA-ggr8-5vv4-36mx. The transitive `buffers@0.1.1` package has no declared license metadata and is reported as unknown pending an upstream dependency change.

Commit 400 did produce GitHub Actions run 36710589456. The workflow triggered correctly and failed in Playwright after earlier validation and build steps succeeded; the earlier issue was run visibility, not a missing push trigger.

The security posture view reports configured controls and aggregate evidence; it is not a penetration test, certification, risk score, or guarantee. Trusted proxy and origin values still require deployment-specific review. The focused hardening journey requires the same disposable PostgreSQL browser environment as the rest of Playwright and therefore relies on CI when no local server is available.

# Deployment

The Compose topology is a single-host reference and still requires operator-managed DNS, certificates, backups, monitoring, and host hardening. Managed-services profile adapters depend on externally supplied compatible services.

Rollback metadata cannot prove arbitrary schema compatibility. Additive changes require review, incompatible changes block rollback, and database schema rollback is intentionally absent.

Browser online state is only a hint and cannot establish API reachability. Narrow-screen coverage is representative rather than a guarantee for every embedded browser.
