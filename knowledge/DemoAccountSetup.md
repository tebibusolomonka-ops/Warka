# Demo account setup

Warka provides an operator command for creating the first organization owner.
It creates the user, password credential, organization, and owner membership in
one transaction. It rejects an existing email or organization name.

With the development database migrated, set the password only in the current
PowerShell process:

```powershell
$env:DATABASE_URL = "postgresql://warka:warka_dev@localhost:5432/warka?schema=public"
$env:WARKA_OWNER_PASSWORD = "<strong-local-password>"
pnpm auth:bootstrap --email <email> --display-name "<name>" --organization "<organization>"
Remove-Item Env:WARKA_OWNER_PASSWORD
```

Do not put the password in a committed environment file, shell script, test
fixture, or documentation. Warka requires a password of at least 12 characters.

The bootstrap command creates an organization owner only. School
administrators, registrars, teachers, students, guardians, bureau users,
support users, and operations users require the corresponding normal Warka
provisioning and access-assignment workflows.
