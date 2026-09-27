import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fileStorageKey, LocalFileStorage } from './fileStorage.js'

async function temporaryRoot() {
  const path = await mkdtemp(join(tmpdir(), 'warka-file-storage-'))
  return {
    path,
    async cleanup() {
      if (!resolve(path).startsWith(resolve(tmpdir()) + sep))
        throw new Error('Temporary storage path escaped temporary directory')
      await rm(path, { recursive: true, force: true })
    },
  }
}

describe('local file storage', () => {
  it('stores, streams, inspects, and deletes generated-key files', async () => {
    const root = await temporaryRoot()
    try {
      const storage = new LocalFileStorage(root.path)
      const bytes = Buffer.from('Warka synthetic file')
      const stored = await storage.put(bytes)
      expect(stored.key).toMatch(/^asset_[0-9a-f-]{36}$/)
      expect(stored.key).not.toContain('synthetic')
      expect(await storage.exists(stored.key)).toBe(true)
      expect(await storage.metadata(stored.key)).toEqual({
        sizeBytes: bytes.length,
      })
      const result = await storage.get(stored.key)
      const chunks: Buffer[] = []
      for await (const chunk of result.stream) chunks.push(Buffer.from(chunk))
      expect(Buffer.concat(chunks)).toEqual(bytes)
      await storage.delete(stored.key)
      expect(await storage.exists(stored.key)).toBe(false)
      await expect(storage.get(stored.key)).rejects.toMatchObject({
        code: 'ENOENT',
      })
    } finally {
      await root.cleanup()
    }
  })

  it('rejects traversal, absolute paths, and access through another root', async () => {
    const first = await temporaryRoot()
    const second = await temporaryRoot()
    try {
      const storage = new LocalFileStorage(first.path)
      const other = new LocalFileStorage(second.path)
      const stored = await storage.put(Buffer.from('private'))
      for (const unsafe of [
        '../secret',
        'asset_../../secret',
        resolve(first.path, stored.key),
      ]) {
        await expect(storage.get(unsafe)).rejects.toThrow(
          'Invalid file storage key',
        )
        await expect(storage.delete(unsafe)).rejects.toThrow(
          'Invalid file storage key',
        )
      }
      expect(await other.exists(stored.key)).toBe(false)
      expect(fileStorageKey()).not.toBe(stored.key)
    } finally {
      await first.cleanup()
      await second.cleanup()
    }
  })
})
