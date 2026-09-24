import { Prisma, type PrismaClient, type User } from '@prisma/client'
import { z } from 'zod'

export type CreateUser = {
  email: string
  displayName: string
}

export class DuplicateEmailError extends Error {
  constructor() {
    super('Email already belongs to a user')
  }
}

export function normalizeEmail(email: string): string {
  return z.email().parse(email.trim().toLowerCase())
}

export async function createUser(
  database: Pick<PrismaClient, 'user'>,
  data: CreateUser,
): Promise<User> {
  try {
    return await database.user.create({
      data: {
        email: normalizeEmail(data.email),
        displayName: data.displayName.trim(),
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DuplicateEmailError()
    }
    throw error
  }
}

export function findUserById(
  database: PrismaClient,
  id: string,
): Promise<User | null> {
  return database.user.findUnique({ where: { id } })
}

export function findUserByEmail(
  database: PrismaClient,
  email: string,
): Promise<User | null> {
  return database.user.findUnique({ where: { email: normalizeEmail(email) } })
}
