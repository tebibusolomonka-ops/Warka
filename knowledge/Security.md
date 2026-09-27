# Security

Authorize every API and domain operation by actor and resource scope. Current account, membership, and assignment periods gate access. Student and guardian visibility follows explicit relationships; bureau and support access have separate boundaries.

Keep credentials and session tokens out of logs, audit metadata, notifications, and responses. Render user text as text. Do not place private student data in operational metadata. Audit privileged changes. Backup and restore must be operator-controlled and must never target the live database for rehearsal.

An operator must be explicitly allowlisted and have a current owner membership on an active account. Public health responses do not expose dependency details. Metrics labels contain routes rather than user, student, or request IDs. Operational alerts use neutral fixed text and deduplicate by recipient and event.
