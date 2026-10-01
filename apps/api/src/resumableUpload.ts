import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { MAX_CHUNKS, requireUploadOwner } from './uploadSessions.js'

export class ResumableUploadStore {
  constructor(private root: string) {}
  async putChunk(sessionId: string, index: number, bytes: Buffer) {
    if (!/^[0-9a-f-]{36}$/i.test(sessionId) || index < 0 || index >= MAX_CHUNKS || bytes.length > 1024 * 1024) throw new Error('chunkInvalid')
    const directory = resolve(this.root, sessionId); if (!directory.startsWith(resolve(this.root))) throw new Error('pathInvalid')
    await mkdir(directory, { recursive: true }); const path = join(directory, String(index))
    try { const existing = await readFile(path); if (!existing.equals(bytes)) throw new Error('duplicateChunkConflict'); return }
    catch (error) { if (error instanceof Error && error.message === 'duplicateChunkConflict') throw error }
    await writeFile(path, bytes, { flag: 'wx' })
  }
  async assemble(sessionId: string, count: number) { const chunks = await Promise.all(Array.from({ length: count }, (_, index) => readFile(join(resolve(this.root, sessionId), String(index))))); const bytes = Buffer.concat(chunks); return { bytes, checksum: createHash('sha256').update(bytes).digest('hex'), scanStatus: 'pending' as const } }
  async cancel(sessionId: string) { await rm(resolve(this.root, sessionId), { recursive: true, force: true }) }
}
export { requireUploadOwner }
