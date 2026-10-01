# BackupAndRestore

## Purpose

Verify backup and isolated restore evidence.

## Preconditions

Select a verified backup and an empty isolated target with sufficient capacity.

## Actions

Command: `pnpm data:verify`

Run the command from the approved repository revision, record its safe summary, and perform only the explicitly authorized operational action.

## Verification

Verify factual health, audit evidence, affected queues, and the intended revision or state. Preserve the result without credentials or private records.

## Stop and escalate

Stop if the target is not isolated, checksums differ, migrations fail, or invariants fail.

