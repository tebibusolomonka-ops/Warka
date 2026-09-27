import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import type { PrismaClient } from '@warka/database'
import {
  backupConnection,
  type BackupStorage,
  type DatabaseConnection,
} from './backupService.js'

export interface RestoreProcess {
  create(connection: DatabaseConnection, target: string): Promise<void>
  restore(
    connection: DatabaseConnection,
    target: string,
    archive: string,
  ): Promise<void>
  check(connection: DatabaseConnection, target: string): Promise<void>
  drop(connection: DatabaseConnection, target: string): Promise<void>
}

function run(tool: string, args: string[], connection: DatabaseConnection) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(tool, args, {
      shell: false,
      env: { PATH: process.env.PATH, PGPASSWORD: connection.password },
      stdio: 'ignore',
    })
    child.once('error', () =>
      reject(new Error('Restore rehearsal process failed')),
    )
    child.once('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error('Restore rehearsal process failed')),
    )
  })
}

function connectionArgs(connection: DatabaseConnection) {
  return [
    '--host',
    connection.host,
    '--port',
    connection.port,
    '--username',
    connection.username,
    '--no-password',
  ]
}

export const nativeRestoreProcess: RestoreProcess = {
  create(connection, target) {
    return run('createdb', [...connectionArgs(connection), target], connection)
  },
  restore(connection, target, archive) {
    return run(
      'pg_restore',
      [
        ...connectionArgs(connection),
        '--no-owner',
        '--no-privileges',
        '--dbname',
        target,
        archive,
      ],
      connection,
    )
  },
  check(connection, target) {
    return run(
      'psql',
      [
        ...connectionArgs(connection),
        '--dbname',
        target,
        '--set',
        'ON_ERROR_STOP=1',
        '--tuples-only',
        '--command',
        "SELECT 1 / CASE WHEN count(*) > 0 THEN 1 ELSE 0 END FROM information_schema.tables WHERE table_schema = 'public'",
      ],
      connection,
    )
  },
  drop(connection, target) {
    return run(
      'dropdb',
      [...connectionArgs(connection), '--if-exists', target],
      connection,
    )
  },
}

export async function runRestoreRehearsal(input: {
  database: PrismaClient
  backupId: string
  actorId: string
  databaseUrl: string
  storage: BackupStorage
  process?: RestoreProcess
}) {
  const connection = backupConnection(input.databaseUrl)
  const backup = await input.database.backupRecord.findUnique({
    where: { id: input.backupId },
  })
  if (!backup || backup.status !== 'verified' || !backup.storageReference)
    throw new Error('A verified backup is required')
  const artifact = await input.storage.inspect(
    `${backup.storageReference}.dump`,
  )
  if (
    artifact.sizeBytes !== backup.sizeBytes ||
    artifact.checksum !== backup.checksum
  )
    throw new Error('Backup artifact integrity changed')
  const target = `warka_rehearsal_${randomUUID().replaceAll('-', '')}`
  if (target === connection.database)
    throw new Error('Restore target must be isolated')
  const rehearsal = await input.database.restoreRehearsal.create({
    data: { backupId: input.backupId, performedById: input.actorId },
  })
  const process = input.process ?? nativeRestoreProcess
  let createAttempted = false
  let passed = false
  try {
    createAttempted = true
    await process.create(connection, target)
    await process.restore(connection, target, artifact.path)
    await process.check(connection, target)
    passed = true
  } catch {
    passed = false
  } finally {
    if (createAttempted) {
      try {
        await process.drop(connection, target)
      } catch {
        passed = false
      }
    }
  }
  await input.database.restoreRehearsal.update({
    where: { id: rehearsal.id },
    data: {
      status: passed ? 'succeeded' : 'failed',
      completedAt: new Date(),
      failureReason: passed ? null : 'Restore rehearsal failed',
    },
  })
  return { id: rehearsal.id, passed }
}
