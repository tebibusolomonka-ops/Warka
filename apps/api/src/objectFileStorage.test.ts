import { Readable } from 'node:stream'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3'
import { describe, expect, it, vi } from 'vitest'
import {
  configuredFileStorage,
  objectStorageConfiguration,
  ObjectFileStorage,
} from './objectFileStorage.js'

function storage(send: ReturnType<typeof vi.fn>) {
  return new ObjectFileStorage(
    { send } as unknown as S3Client,
    'private-bucket',
  )
}

describe('private object file storage', () => {
  it('uses generated keys for put, get, exists, metadata, and delete', async () => {
    const send = vi.fn().mockImplementation(async (command: unknown) => {
      if (command instanceof GetObjectCommand)
        return { Body: Readable.from(Buffer.from('file')), ContentLength: 4 }
      if (command instanceof HeadObjectCommand) return { ContentLength: 4 }
      return {}
    })
    const adapter = storage(send)
    const stored = await adapter.put(Buffer.from('file'))
    expect(stored.key).toMatch(/^asset_[0-9a-f-]{36}$/)
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand)
    expect(await adapter.exists(stored.key)).toBe(true)
    expect(await adapter.metadata(stored.key)).toEqual({ sizeBytes: 4 })
    const result = await adapter.get(stored.key)
    expect(result.sizeBytes).toBe(4)
    const chunks: Buffer[] = []
    for await (const chunk of result.stream) chunks.push(Buffer.from(chunk))
    expect(Buffer.concat(chunks).toString()).toBe('file')
    await adapter.delete(stored.key)
    expect(send.mock.calls.at(-1)?.[0]).toBeInstanceOf(DeleteObjectCommand)
    await expect(adapter.get('../secret')).rejects.toThrow(
      'Invalid file storage key',
    )
  })

  it('treats only not-found object responses as missing', async () => {
    const missing = storage(
      vi.fn().mockRejectedValue({ $metadata: { httpStatusCode: 404 } }),
    )
    expect(
      await missing.exists('asset_11111111-1111-4111-8111-111111111111'),
    ).toBe(false)
    const denied = storage(
      vi.fn().mockRejectedValue({ $metadata: { httpStatusCode: 403 } }),
    )
    await expect(
      denied.exists('asset_11111111-1111-4111-8111-111111111111'),
    ).rejects.toBeTruthy()
  })

  it('validates provider-neutral configuration without exposing credentials', () => {
    expect(() =>
      objectStorageConfiguration({ FILE_STORAGE_BUCKET: 'private-bucket' }),
    ).toThrow()
    expect(() =>
      objectStorageConfiguration({
        FILE_STORAGE_BUCKET: 'private-bucket',
        FILE_STORAGE_REGION: 'us-east-1',
        FILE_STORAGE_ENDPOINT: 'http://public.example.test',
      }),
    ).toThrow()
    expect(() =>
      objectStorageConfiguration({
        FILE_STORAGE_BUCKET: 'private-bucket',
        FILE_STORAGE_REGION: 'us-east-1',
        FILE_STORAGE_ACCESS_KEY_ID: 'key',
      }),
    ).toThrow('Incomplete object storage credentials')
    const configured = configuredFileStorage({
      FILE_STORAGE_BACKEND: 's3',
      FILE_STORAGE_BUCKET: 'private-bucket',
      FILE_STORAGE_REGION: 'us-east-1',
      FILE_STORAGE_ENDPOINT: 'http://localhost:9000',
    })
    expect(configured).toBeInstanceOf(ObjectFileStorage)
  })
})
