import {
  createEnrollment,
  createGuardian,
  linkGuardianToStudent,
  listGuardiansForStudent,
  registerStudentRecord,
  type Enrollment,
  type Guardian,
  type PossibleDuplicate,
  type PrismaClient,
  type Student,
} from '@warka/database'
import type { RegisterStudent } from '@warka/shared'

export type GuardianRecord = {
  guardian: Guardian
  relationship: string
}

export type RegisteredStudent = {
  student: Student
  enrollment: Enrollment
  guardians: GuardianRecord[]
  possibleDuplicates: PossibleDuplicate[]
}

export type StudentListItem = {
  student: Student
  enrollment: Enrollment
}

export type StudentDetail = {
  student: Student
  enrollments: Enrollment[]
  guardians: GuardianRecord[]
}

export type StudentService = {
  register(schoolId: string, input: RegisterStudent): Promise<RegisteredStudent>
  list(
    schoolId: string,
    limit: number,
    offset: number,
  ): Promise<StudentListItem[]>
  find(schoolId: string, studentId: string): Promise<StudentDetail | null>
}

export function prismaStudentService(database: PrismaClient): StudentService {
  return {
    register(schoolId, input) {
      return database.$transaction(async (transaction) => {
        const { student, possibleDuplicates } = await registerStudentRecord(
          transaction,
          schoolId,
          input.student,
        )
        const enrollment = await createEnrollment(transaction, {
          studentId: student.id,
          schoolId,
          academicYearId: input.academicYearId,
          gradeLevelId: input.gradeLevelId,
          ...(input.schoolClassId
            ? { schoolClassId: input.schoolClassId }
            : {}),
        })
        const guardians: GuardianRecord[] = []
        for (const item of input.guardians ?? []) {
          const guardian = await createGuardian(transaction, {
            name: item.name,
            ...(item.phone ? { phone: item.phone } : {}),
            ...(item.email ? { email: item.email } : {}),
          })
          await linkGuardianToStudent(transaction, {
            studentId: student.id,
            guardianId: guardian.id,
            relationship: item.relationship,
          })
          guardians.push({ guardian, relationship: item.relationship })
        }
        return { student, enrollment, guardians, possibleDuplicates }
      })
    },
    async list(schoolId, limit, offset) {
      const students = await database.student.findMany({
        where: { enrollments: { some: { schoolId } } },
        include: {
          enrollments: {
            where: { schoolId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      })
      return students.flatMap(({ enrollments, ...student }) =>
        enrollments[0] ? [{ student, enrollment: enrollments[0] }] : [],
      )
    },
    async find(schoolId, studentId) {
      const enrollments = await database.enrollment.findMany({
        where: { schoolId, studentId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
      if (enrollments.length === 0) return null
      const student = await database.student.findUnique({
        where: { id: studentId },
      })
      if (!student) return null
      const guardians = await listGuardiansForStudent(database, studentId)
      return { student, enrollments, guardians }
    },
  }
}
