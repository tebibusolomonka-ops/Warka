import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { ResumableUploadStore } from './resumableUpload.js'
it('assembles ordered chunks and leaves scanning pending', async () => {
  const store = new ResumableUploadStore(
    await mkdtemp(join(tmpdir(), 'warka-upload-')),
  )
  const id = '00000000-0000-4000-8000-000000000001'
  await store.putChunk(id, 0, Buffer.from('a'))
  await store.putChunk(id, 1, Buffer.from('b'))
  const result = await store.assemble(id, 2)
  expect(result.bytes.toString()).toBe('ab')
  expect(result.scanStatus).toBe('pending')
})
