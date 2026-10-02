# Development and testing limitations

- Local development does not configure every external provider. SMTP,
  ClamAV, and object storage require environment-specific services,
  credentials, network policy, and acceptance checks.
- Deterministic or in-memory providers used by automated tests establish
  application behavior at controlled boundaries; they do not prove delivery
  by a production provider.
- Automated accessibility scans, semantic component tests, and keyboard
  journeys do not replace manual screen-reader, zoom, contrast, translation,
  and device testing.
- Historical upgrade coverage uses selected synthetic milestone fixtures.
  Those fixtures do not represent every database state that may have existed
  between milestones.
- Native PostgreSQL backup and restore behavior depends on compatible tools and
  an isolated target environment. Mocked process boundaries are not a restore
  rehearsal.
- Load measurements describe the selected fixture, workstation, and deployment
  topology. They are not universal service-level guarantees.
- Amharic and Afaan Oromo catalogs require linguistic review for their intended
  deployment context. Ethiopian-calendar display depends on the platform's
  internationalization implementation.

Resolved workstation or batch-specific failures should remain in batch history
rather than being presented as current product limitations.
