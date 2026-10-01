# ProductionDeployment

## Purpose

Deploy a verified Warka release.

## Preconditions

Confirm the approved revision, immutable images, backup evidence, and rollback owner.

## Actions

Command: `pnpm deployment:manifest:check`

Run the command from the approved repository revision, record its safe summary, and perform only the explicitly authorized operational action.

## Verification

Verify factual health, audit evidence, affected queues, and the intended revision or state. Preserve the result without credentials or private records.

## Stop and escalate

Stop when readiness is blocked, evidence is stale, or the revision differs.

