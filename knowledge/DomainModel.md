# Domain model

An organization contains schools, academic years, classes, memberships, and teaching assignments. Membership and assignment periods determine current authority; account lifecycle also gates access. A `Student` is distinct from a login `User`; a `Guardian` is likewise distinct, with explicit student relationships. School staff, bureau operators, and support users obtain different scoped capabilities.

Enrollment, attendance, marks, and document workflows preserve review and historical states. Published results and issued documents are immutable snapshots with explicit correction or withdrawal paths. Transfers carry source and destination context. Privacy access and correction requests route to existing official correction workflows; retention holds block destructive action. Audit and notifications accompany sensitive transitions.

Backup records track archive metadata, integrity verification, and isolated restore rehearsals. Backup policy stores operational frequency and count, separate from personal-data retention. Operational incidents have controlled severity and state plus append-only updates. Maintenance windows communicate planned work without taking the service offline.

`FileAsset` records identify a controlled purpose, school scope, storage key, checksum, size, lifecycle status, and optional link to a learning material or issued document. A document profile points to its current logo asset; prior assets and corrected document PDFs retain their own historical metadata. Bytes remain outside PostgreSQL.

`FileScan` records controlled status, result, timestamps, and failure code for an asset. Required uploads begin pending; a clean result permits availability, infection quarantines the asset, and scanner failure leaves it unavailable. Rescans create new scan records and scheduled work.

Search results are derived summaries, not a new durable identity or access grant. They contain a type, safe title and subtitle, a domain reference, and school scope; opening a result checks current authorization again.
