import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import type { PrismaClient } from '@warka/database'
import {
  completeBackup,
  createPendingBackup,
  failBackup,
  startBackup,
} from '@warka/database'

export type BackupArtifact = { reference: string; path: string }
export interface BackupStorage {
  allocate(): Promise<BackupArtifact>
  inspect(
    reference: string,
  ): Promise<{ path: string; sizeBytes: bigint; checksum: string }>
  remove(reference: string): Promise<void>
}

export class LocalBackupStorage implements BackupStorage {
  private readonly root: string
  constructor(root: string) {
    this.root = resolve(root)
  }
  private path(reference: string) {
    if (!/^backup_[0-9a-f-]{36}\.dump$/.test(reference))
      throw new Error('Invalid backup reference')
    return join(this.root, reference)
  }
  async allocate() {
    await mkdir(this.root, { recursive: true, mode: 0o700 })
    const reference = `backup_${randomUUID()}.dump`
    return { reference, path: this.path(reference) }
  }
  async inspect(reference: string) {
    const path = this.path(reference)
    const file = await stat(path)
    if (!file.isFile()) throw new Error('Backup artifact is not a file')
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(path)) hash.update(chunk)
    return { path, sizeBytes: BigInt(file.size), checksum: hash.digest('hex') }
  }
  async remove(reference: string) {
    await rm(this.path(reference), { force: true })
  }
}

export type DatabaseConnection = {
  host: string
  port: string
  database: string
  username: string
  password: string
}

export function backupConnection(databaseUrl: string): DatabaseConnection {
  const url = new URL(databaseUrl)
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    !url.hostname ||
    !url.pathname.slice(1) ||
    !url.username
  ) {
    throw new Error('Invalid PostgreSQL backup configuration')
  }
  return {
    host: url.hostname,
    port: url.port || '5432',
    database: decodeURIComponent(url.pathname.slice(1)),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  }
}

export interface BackupProcess {
  dump(connection: DatabaseConnection, destination: string): Promise<void>
}

export const nativeBackupProcess: BackupProcess = {
  async dump(connection, destination) {
    const args = [
      '--format=custom',
      '--no-password',
      '--host',
      connection.host,
      '--port',
      connection.port,
      '--username',
      connection.username,
      '--dbname',
      connection.database,
    ]
    await new Promise<void>((resolvePromise, reject) => {
      const output = createWriteStream(destination, {
        flags: 'wx',
        mode: 0o600,
      })
      const child = spawn('pg_dump', args, {
        shell: false,
        env: { PATH: process.env.PATH, PGPASSWORD: connection.password },
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      child.stdout.pipe(output)
      child.once('error', () =>
        reject(new Error('PostgreSQL backup process failed')),
      )
      output.once('error', () =>
        reject(new Error('Backup storage write failed')),
      )
      child.once('close', (code) => {
        output.end(() =>
          code === 0
            ? resolvePromise()
            : reject(new Error('PostgreSQL backup process failed')),
        )
      })
    })
  },
}

export async function executeBackup(input: {
  database: PrismaClient
  actorId: string
  databaseUrl: string
  storage: BackupStorage
  process?: BackupProcess
}) {
  const connection = backupConnection(input.databaseUrl)
  const record = await createPendingBackup(input.database, input.actorId)
  let artifact: BackupArtifact | undefined
  try {
    await startBackup(input.database, record.id)
    artifact = await input.storage.allocate()
    await (input.process ?? nativeBackupProcess).dump(connection, artifact.path)
    const inspected = await input.storage.inspect(artifact.reference)
    await completeBackup(input.database, record.id, {
      sizeBytes: inspected.sizeBytes,
      checksum: inspected.checksum,
      storageReference: artifact.reference.replace(/\.dump$/, ''),
    })
    return record.id
  } catch {
    if (artifact)
      await input.storage.remove(artifact.reference).catch(() => undefined)
    await failBackup(input.database, record.id, 'Backup execution failed')
    throw new Error('Backup execution failed')
  }
}
