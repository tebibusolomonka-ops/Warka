import {
  Prisma,
  type Guardian,
  type PrismaClient,
  type Student,
  type StudentGuardian,
} from '@prisma/client'
import { z } from 'zod'

export const CreateGuardianSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(40).optional(),
  email: z.string().trim().toLowerCase().pipe(z.email()).optional(),
})

export type CreateGuardian = z.input<typeof CreateGuardianSchema>

export const LinkGuardianSchema = z.strictObject({
  studentId: z.uuid(),
  guardianId: z.uuid(),
  relationship: z.string().trim().min(1).max(100),
})

export type LinkGuardian = z.input<typeof LinkGuardianSchema>

export type GuardianForStudent = {
  guardian: Guardian
  relationship: string
}

export type StudentForGuardian = {
  student: Student
  relationship: string
}

export class DuplicateGuardianLinkError extends Error {
  constructor() {
    super('Guardian is already linked to this student')
  }
}

export function createGuardian(
  database: PrismaClient,
  input: CreateGuardian,
): Promise<Guardian> {
  const data = CreateGuardianSchema.parse(input)
  return database.guardian.create({
    data: {
      name: data.name,
      ...(data.phone ? { phone: data.phone } : {}),
      ...(data.email ? { email: data.email } : {}),
    },
  })
}

export async function linkGuardianToStudent(
  database: PrismaClient,
  input: LinkGuardian,
): Promise<StudentGuardian> {
  const data = LinkGuardianSchema.parse(input)
  try {
    return await database.studentGuardian.create({ data })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DuplicateGuardianLinkError()
    }
    throw error
  }
}

export async function listGuardiansForStudent(
  database: PrismaClient,
  studentId: string,
): Promise<GuardianForStudent[]> {
  const links = await database.studentGuardian.findMany({
    where: { studentId },
    include: { guardian: true },
    orderBy: [{ guardian: { name: 'asc' } }, { guardianId: 'asc' }],
  })
  return links.map(({ guardian, relationship }) => ({
    guardian,
    relationship,
  }))
}

export async function listStudentsForGuardian(
  database: PrismaClient,
  guardianId: string,
): Promise<StudentForGuardian[]> {
  const links = await database.studentGuardian.findMany({
    where: { guardianId },
    include: { student: true },
    orderBy: [{ student: { givenName: 'asc' } }, { studentId: 'asc' }],
  })
  return links.map(({ student, relationship }) => ({
    student,
    relationship,
  }))
}
