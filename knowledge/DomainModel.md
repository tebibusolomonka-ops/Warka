# Domain model

An organization contains schools, academic years, classes, memberships, and teaching assignments. Membership and assignment periods determine current authority; account lifecycle also gates access. A `Student` is distinct from a login `User`; a `Guardian` is likewise distinct, with explicit student relationships. School staff, bureau operators, and support users obtain different scoped capabilities.

Enrollment, attendance, marks, and document workflows preserve review and historical states. Published results and issued documents are immutable snapshots with explicit correction or withdrawal paths. Transfers carry source and destination context. Privacy access and correction requests route to existing official correction workflows; retention holds block destructive action. Audit and notifications accompany sensitive transitions.

Backup records track archive metadata, integrity verification, and isolated restore rehearsals. Backup policy stores operational frequency and count, separate from personal-data retention. Operational incidents have controlled severity and state plus append-only updates. Maintenance windows communicate planned work without taking the service offline.
