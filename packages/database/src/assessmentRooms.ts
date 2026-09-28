import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const AssessmentRoomInputSchema = z.strictObject({
  schoolId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(24),
  capacity: z.number().int().positive().optional(),
})

export class AssessmentRoomConflictError extends Error {}

export async function createAssessmentRoom(
  database: PrismaClient,
  input: z.input<typeof AssessmentRoomInputSchema>,
) {
  const data = AssessmentRoomInputSchema.parse(input)
  try {
    return await database.assessmentRoom.create({
      data: { ...data, capacity: data.capacity ?? null },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new AssessmentRoomConflictError('Room name or code already exists')
    }
    throw error
  }
}

export async function setAssessmentRoomActive(
  database: PrismaClient,
  schoolId: string,
  roomId: string,
  active: boolean,
) {
  return database.assessmentRoom.update({
    where: { id_schoolId: { id: roomId, schoolId } },
    data: { active },
  })
}

export async function listAssessmentRooms(
  database: PrismaClient,
  schoolId: string,
) {
  return database.assessmentRoom.findMany({
    where: { schoolId },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
}
