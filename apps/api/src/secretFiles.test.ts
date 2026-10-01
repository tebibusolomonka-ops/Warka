import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadSecretFiles } from './secretFiles.js'

describe('secret file loading', () => {
  it('loads approved keys and preserves an explicit environment value', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'warka-secret-'))
    const file = join(directory, 'database-url')
    await writeFile(file, 'postgresql://secret\n')
    const fromFile: NodeJS.ProcessEnv = { DATABASE_URL_FILE: file }
    await loadSecretFiles(fromFile)
    expect(fromFile.DATABASE_URL).toBe('postgresql://secret')
    const explicit: NodeJS.ProcessEnv = {
      DATABASE_URL: 'explicit',
      DATABASE_URL_FILE: file,
    }
    await loadSecretFiles(explicit)
    expect(explicit.DATABASE_URL).toBe('explicit')
  })

  it('rejects binary and oversized files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'warka-secret-'))
    const binary = join(directory, 'binary')
    await writeFile(binary, Buffer.from([1, 0, 2]))
    await expect(
      loadSecretFiles({ SMTP_PASSWORD_FILE: binary }),
    ).rejects.toThrow('not a text secret')
    const large = join(directory, 'large')
    await writeFile(large, 'x'.repeat(64 * 1024 + 1))
    await expect(
      loadSecretFiles({ SMTP_PASSWORD_FILE: large }),
    ).rejects.toThrow('size limit')
  })
})
