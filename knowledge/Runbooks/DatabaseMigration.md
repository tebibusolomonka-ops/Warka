# DatabaseMigration

## Purpose

Apply forward-only production migrations.

## Preconditions

Use an isolated rehearsal first, verify a recent backup, and approve the migration window.

## Actions

Command: `pnpm db:preflight`

Run the command from the approved repository revision, record its safe summary, and perform only the explicitly authorized operational action.

## Verification

Verify factual health, audit evidence, affected queues, and the intended revision or state. Preserve the result without credentials or private records.

## Stop and escalate

Stop on drift, lock risk, failed preflight, or any request to downgrade automatically.

