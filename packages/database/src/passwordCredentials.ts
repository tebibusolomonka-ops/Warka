import type { PrismaClient } from '@prisma/client'

export async function savePasswordHash(
  database: PrismaClient,
  userId: string,
  passwordHash: string,
): Promise<void> {
  await database.passwordCredential.upsert({
    where: { userId },
    create: { userId, passwordHash },
    update: { passwordHash },
  })
}

export async function findPasswordHashForUser(
  database: PrismaClient,
  userId: string,
): Promise<string | null> {
  const credential = await database.passwordCredential.findUnique({
    where: { userId },
    select: { passwordHash: true },
  })
  return credential?.passwordHash ?? null
}

export async function mustChangePassword(
  database: PrismaClient,
  userId: string,
): Promise<boolean> {
  const credential = await database.passwordCredential.findUnique({
    where: { userId },
    select: { mustChangePassword: true },
  })
  return credential?.mustChangePassword ?? false
}
