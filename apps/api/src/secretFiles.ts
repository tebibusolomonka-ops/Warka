import { readFile } from 'node:fs/promises'

export const approvedSecretKeys = [
  'DATABASE_URL',
  'WARKA_RECOVERY_TOKEN_KEY',
  'WARKA_SESSION_SECRET',
  'SMTP_PASSWORD',
  'OBJECT_STORAGE_SECRET_KEY',
] as const

const maxSecretBytes = 64 * 1024

export async function loadSecretFiles(env: NodeJS.ProcessEnv) {
  for (const key of approvedSecretKeys) {
    const path = env[`${key}_FILE`]
    if (!path || env[key] !== undefined) continue
    const value = await readFile(path)
    if (value.byteLength > maxSecretBytes)
      throw new Error(`${key}_FILE exceeds the secret size limit`)
    if (value.includes(0)) throw new Error(`${key}_FILE is not a text secret`)
    env[key] = value.toString('utf8').replace(/(?:\r?\n)$/, '')
  }
}
