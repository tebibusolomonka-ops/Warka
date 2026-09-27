# Security

Authorize every API and domain operation by actor and resource scope. Current account, membership, and assignment periods gate access. Student and guardian visibility follows explicit relationships; bureau and support access have separate boundaries.

Keep credentials and session tokens out of logs, audit metadata, notifications, and responses. Render user text as text. Do not place private student data in operational metadata. Audit privileged changes. Backup and restore must be operator-controlled and must never target the live database for rehearsal.

An operator must be explicitly allowlisted and have a current owner membership on an active account. Public health responses do not expose dependency details. Metrics labels contain routes rather than user, student, or request IDs. Operational alerts use neutral fixed text and deduplicate by recipient and event.

Never authorize a file by asset ID or possession alone. Learning files require current teaching control or eligible published-class access; guardian access follows the parent relationship. Issued PDF access requires the student or authorized issuing-school staff. Logos have a school administration boundary. Responses use private caching, safe download names, and no raw storage keys, bucket URLs, or credentials. Public verification exposes record status only.

Required file uploads stay inaccessible until their latest scan is clean. Infected assets become quarantined; scanner outage and failure never promote availability. Operators need both allowlisting and current owner access to inspect safe scan metadata or request rescan/removal. Notifications contain fixed neutral text and deduplicate by scan and recipient.

Search is authorization filtered and excludes credentials, sessions, family message bodies, and private security metadata. A public verification reference does not permit private search or opening. Search responses are bounded summaries and no-store; selected authenticated metadata uses user-specific private validators. Binary artifacts retain private no-store delivery without compression.
