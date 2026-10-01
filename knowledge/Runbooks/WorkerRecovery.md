# WorkerRecovery

## Purpose

Reconcile interrupted scheduled work.

## Preconditions

Confirm leases expired and classify each task as safe retry or review required.

## Actions

Command: `pnpm drill:recovery`

Run the command from the approved repository revision, record its safe summary, and perform only the explicitly authorized operational action.

## Verification

Verify factual health, audit evidence, affected queues, and the intended revision or state. Preserve the result without credentials or private records.

## Stop and escalate

Stop when an external effect may have occurred or ownership is still active.

