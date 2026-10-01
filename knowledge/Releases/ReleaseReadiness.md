# Warka release readiness

## Release identity

- Version: `0.1.0`
- Milestone: planned commit 500
- Date: 2026-10-01
- Evidence base: repository commands and GitHub Actions for the final milestone revision

## Verified evidence

- Prisma schema validation, forward migration deployment, and migration preflight run in CI with isolated PostgreSQL.
- Unit, integration, API, shared, and web tests run through `pnpm test`.
- Browser acceptance includes student, guardian, teacher, school administration, bureau, support, and Operations journeys.
- Automated accessibility checks cover the sign-in surface and component semantics. This is partial evidence rather than professional certification.
- Security validation includes secret scanning, dependency metadata, dependency audit policy, SBOM generation, browser security controls, and CI supply-chain policy.
- API and web production images build as non-root runtime images; Compose and gateway configuration are structurally validated.
- Selected synthetic historical milestones pass the upgrade preservation matrix. The fixtures do not represent every historical database state.
- `pnpm data:verify` is read only and emits bounded structured violations without dumping records.
- Backup and restore services require verified backup evidence and an isolated restore target. Local restore rehearsal was not run where PostgreSQL tools were unavailable.
- `pnpm test:release-candidate`, `pnpm acceptance:check`, `pnpm runbooks:check`, `pnpm readiness:check`, and `pnpm release:audit` provide repository-owned evidence.

## Operational boundaries

- Fault injection, deterministic providers, and drills reject production activation.
- Readiness presents explicit facts and unavailable evidence without a numerical score.
- Alert acknowledgement does not mark a dependency healthy. Maintenance does not change health and cannot silently suppress security or integrity evidence.
- Incident timelines are append only; corrections append evidence. Reviews allow unknown or under-investigation root cause.
- Pilot schools are not ranked. Missing prerequisites remain visible and activation is explicit.
- Rollback tooling does not automate database downgrade.

## Domain and privacy boundaries

- Missing marks remain distinct from zero, and missing re-enrollment is not interpreted as dropout.
- Duplicates, guardian relationships, and imported student accounts are not automatically merged, verified, or provisioned.
- Bureau access remains purpose limited. Reporting blanks remain distinct from zero and submitted versions remain immutable.
- Coursework scores require explicit controlled transfer before becoming official marks.
- File availability requires a clean scan. Public document verification exposes minimal facts and never grants private PDF access.
- The service worker excludes private API responses from offline caching.

## Remaining limitations

- Live external SMTP, malware scanner, object storage, and hosting-provider integrations require environment-specific acceptance.
- Local Docker and PostgreSQL availability depends on the operator workstation; CI supplies those isolated services.
- Historical fixtures cover selected milestones rather than every historical state.
- Automated accessibility evidence does not replace manual assistive-technology testing or a professional audit.
- Security checks and SBOM evidence do not constitute a penetration test or external certification.
- Production readiness still requires current backup, restore, provider, scheduler, communication, and deployment evidence from the target environment.
