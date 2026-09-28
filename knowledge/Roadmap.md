# Roadmap

## Completed

Core school, academic, student, guardian, document, reporting, transfer, privacy, governance, and lifecycle workflows. Operator-controlled backup, verification, restore rehearsal, service status, incidents, maintenance, metrics, and alerts through commit 180. Database-coordinated scheduling, bounded retries, scheduled verification, and operational artifact cleanup through commit 190. Purpose-bound learning uploads, school logos, stored issued PDFs, private delivery, and a safe operator storage summary through commit 200.

## Current

Notification delivery preferences, safe notification email routing, digest scheduling, and communication journeys follow the transactional email foundation through commit 230. Deployment validation is still needed for SMTP, the scheduler, private file storage, ClamAV, PostgreSQL search indexes, and caching. Full offline synchronization remains separate future work and is not implemented.

## Later

Production storage configuration and operational deployment decisions remain environment-specific. No delivery commitment is implied.
Communication preference controls, safe notification email routing, daily/weekly digests, owned delivery history, and controlled browser journeys are implemented through commit 240. Deployment still requires PostgreSQL migration, a stable recovery key, a public app URL, and configured SMTP.
Timetable calendar, periods, class versions, conflict validation, administrator API/workspace, teacher view, and browser journey are implemented through commit 250. Attendance capture and family views follow in commits 251–260.
- Batch 241–260 adds school timetable and attendance foundations, administration and teacher workflows, family attendance visibility, and factual summaries. Deployment validation still requires migrations and PostgreSQL-backed CI.
- Commits 261–270 add assessment rooms, schedules, conflict checks, sessions, participation, make-up review, invigilation, API/workspace, and a browser journey. Gradebook control and result readiness follow in 271–280.
- Commits 271–280 add server-enforced entry windows, completeness, moderation history, gradebook locks, readiness, staff controls, scoped family progress summaries, and a browser journey. Deployment still requires PostgreSQL migration and CI-backed browser validation.
- Commits 281–290 add assignment publication, enrollment-derived audience, immutable submitted revisions, shared secure file uploads, personal extensions, scoped API actions, and the teacher workspace. Student UI, review, rubrics, feedback, explicit official mark transfer, guardian views, and browser journeys follow in 291–300.
- Commits 291–300 add the student workspace, review, frozen versioned rubrics, released feedback, explicit official mark transfer, verified guardian reads, preference-aware notifications, factual summaries, and a browser journey. PostgreSQL-backed migration and browser execution remain deployment and CI checks.
