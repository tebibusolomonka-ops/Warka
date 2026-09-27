import { randomUUID } from 'node:crypto'
import { createReadStream, type ReadStream } from 'node:fs'
import { lstat, mkdir, open, realpath, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export type StoredFile = { key: string; sizeBytes: number }
export interface FileStorage {
  put(bytes: Uint8Array): Promise<StoredFile>
  get(
    key: string,
  ): Promise<{ stream: ReadStream | NodeJS.ReadableStream; sizeBytes: number }>
  exists(key: string): Promise<boolean>
  delete(key: string): Promise<void>
  metadata(key: string): Promise<{ sizeBytes: number }>
}

export function fileStorageKey() {
  return `asset_${randomUUID()}`
}

export class LocalFileStorage implements FileStorage {
  private readonly root: string
  constructor(root: string) {
    if (!root.trim()) throw new Error('File storage root is required')
    this.root = resolve(root)
  }

  private path(key: string) {
    if (
      !/^asset_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        key,
      )
    )
      throw new Error('Invalid file storage key')
    return join(this.root, key)
  }

  private async rootPath() {
    await mkdir(this.root, { recursive: true, mode: 0o700 })
    const actual = await realpath(this.root)
    if (resolve(actual).toLowerCase() !== this.root.toLowerCase())
      throw new Error('File storage root must not be a symlink')
  }

  private async checkedFile(key: string) {
    await this.rootPath()
    const path = this.path(key)
    const file = await lstat(path)
    if (!file.isFile() || file.isSymbolicLink())
      throw new Error('Invalid stored file')
    const actual = await realpath(path)
    if (resolve(actual).toLowerCase() !== path.toLowerCase())
      throw new Error('Stored file escaped storage root')
    return { path, sizeBytes: file.size }
  }

  async put(bytes: Uint8Array) {
    await this.rootPath()
    const key = fileStorageKey()
    const path = this.path(key)
    const handle = await open(path, 'wx', 0o600)
    try {
      await handle.writeFile(bytes)
    } catch {
      await handle.close()
      await rm(path, { force: true })
      throw new Error('File storage write failed')
    }
    await handle.close()
    return { key, sizeBytes: bytes.byteLength }
  }

  async get(key: string) {
    const file = await this.checkedFile(key)
    return { stream: createReadStream(file.path), sizeBytes: file.sizeBytes }
  }

  async exists(key: string) {
    try {
      await this.checkedFile(key)
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw error
    }
  }

  async delete(key: string) {
    const file = await this.checkedFile(key)
    await rm(file.path)
  }

  async metadata(key: string) {
    const file = await this.checkedFile(key)
    return { sizeBytes: file.sizeBytes }
  }
}
