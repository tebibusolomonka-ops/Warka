# Rollback

## Purpose

Return application code to an approved compatible release.

## Preconditions

Confirm release compatibility, current migration state, backup evidence, and approval.

## Actions

Command: `pnpm deployment:rollback`

Run the command from the approved repository revision, record its safe summary, and perform only the explicitly authorized operational action.

## Verification

Verify factual health, audit evidence, affected queues, and the intended revision or state. Preserve the result without credentials or private records.

## Stop and escalate

Never automate database downgrade; stop when the prior release cannot read the current schema.

