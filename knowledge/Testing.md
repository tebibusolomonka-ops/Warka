# Testing

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
