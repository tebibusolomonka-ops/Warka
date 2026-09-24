import { randomBytes } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'
import { savePasswordHash, type PrismaClient } from '@warka/database'
import { z } from 'zod'

export const PasswordSchema = z.string().min(12).max(1024)

const hashOptions = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
}

const missingCredentialHash = hash(randomBytes(32).toString('hex'), hashOptions)

export async function hashPassword(password: string): Promise<string> {
  return hash(PasswordSchema.parse(password), hashOptions)
}

export async function setPassword(
  database: PrismaClient,
  userId: string,
  password: string,
): Promise<void> {
  const passwordHash = await hashPassword(password)
  await savePasswordHash(database, userId, passwordHash)
}

export async function verifyPassword(
  password: string,
  passwordHash: string | null,
): Promise<boolean> {
  const candidate = passwordHash ?? (await missingCredentialHash)
  try {
    const matches = await verify(candidate, password)
    return passwordHash !== null && matches
  } catch {
    return false
  }
}
