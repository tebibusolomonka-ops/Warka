import { Readable } from 'node:stream'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import {
  assertFileStorageKey,
  fileStorageKey,
  LocalFileStorage,
  type FileStorage,
} from './fileStorage.js'
import { environmentProfile } from './environmentProfile.js'

export function configuredFileStorage(
  env: NodeJS.ProcessEnv = process.env,
): FileStorage {
  const profile = environmentProfile(env)
  if (env.FILE_STORAGE_BACKEND === 's3') {
    const { bucket, client } = objectStorageConfiguration(env)
    return new ObjectFileStorage(client, bucket)
  }
  if (
    (env.FILE_STORAGE_BACKEND === 'local' && profile.name !== 'production') ||
    (!env.FILE_STORAGE_BACKEND && profile.defaultFileStorage === 'local')
  ) {
    if (!env.FILE_STORAGE_DIR)
      throw new Error('File storage directory is required')
    return new LocalFileStorage(env.FILE_STORAGE_DIR)
  }
  throw new Error('Invalid file storage backend')
}

export function objectStorageConfiguration(env: NodeJS.ProcessEnv) {
  const bucket = env.FILE_STORAGE_BUCKET ?? ''
  const region = env.FILE_STORAGE_REGION ?? ''
  const endpoint = env.FILE_STORAGE_ENDPOINT
  const accessKeyId = env.FILE_STORAGE_ACCESS_KEY_ID
  const secretAccessKey = env.FILE_STORAGE_SECRET_ACCESS_KEY
  if (
    !/^[a-z0-9][a-z0-9.-]{2,62}$/.test(bucket) ||
    !/^[a-z0-9-]{2,40}$/.test(region)
  )
    throw new Error('Invalid object storage configuration')
  if (!!accessKeyId !== !!secretAccessKey)
    throw new Error('Incomplete object storage credentials')
  if (endpoint) {
    const url = new URL(endpoint)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid object storage endpoint')
  }
  return {
    bucket,
    client: new S3Client({
      region,
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    }),
  }
}

export class ObjectFileStorage implements FileStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async put(bytes: Uint8Array) {
    const key = fileStorageKey()
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentLength: bytes.byteLength,
      }),
    )
    return { key, sizeBytes: bytes.byteLength }
  }

  async get(key: string) {
    assertFileStorageKey(key)
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    )
    if (
      !(result.Body instanceof Readable) ||
      result.ContentLength === undefined
    )
      throw new Error('Object storage returned an invalid file')
    return { stream: result.Body, sizeBytes: result.ContentLength }
  }

  async exists(key: string) {
    assertFileStorageKey(key)
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      )
      return true
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode
      if (status === 404) return false
      throw error
    }
  }

  async delete(key: string) {
    assertFileStorageKey(key)
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    )
  }

  async metadata(key: string) {
    assertFileStorageKey(key)
    const result = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    )
    if (result.ContentLength === undefined)
      throw new Error('Object storage returned incomplete metadata')
    return { sizeBytes: result.ContentLength }
  }
}
