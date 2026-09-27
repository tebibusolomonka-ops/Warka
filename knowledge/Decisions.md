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

See [[Security]] for the resulting invariants.
