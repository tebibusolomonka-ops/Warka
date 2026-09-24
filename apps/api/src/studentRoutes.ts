import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import {
  EnrollmentSchema,
  GuardianLinkSchema,
  RegisterStudentSchema,
  RegistrationResponseSchema,
  StudentDetailResponseSchema,
  StudentListResponseSchema,
  StudentSchema,
} from '@warka/shared'
import type {
  Enrollment,
  Guardian,
  PossibleDuplicate,
  Student,
} from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import type { SchoolAccess } from './schoolAccess.js'
import { RecordNotFound, type SchoolStore } from './schoolService.js'
import type { StudentService } from './studentService.js'

const schoolParams = z.object({ schoolId: z.uuid() })
const studentParams = z.object({ schoolId: z.uuid(), studentId: z.uuid() })
const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

function studentResponse(student: Student) {
  return StudentSchema.parse({
    id: student.id,
    studentReference: student.studentReference,
    givenName: student.givenName,
    familyName: student.familyName,
    dateOfBirth: student.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    createdAt: student.createdAt.toISOString(),
    updatedAt: student.updatedAt.toISOString(),
  })
}

export function enrollmentResponse(enrollment: Enrollment) {
  return EnrollmentSchema.parse({
    id: enrollment.id,
    studentId: enrollment.studentId,
    schoolId: enrollment.schoolId,
    academicYearId: enrollment.academicYearId,
    gradeLevelId: enrollment.gradeLevelId,
    schoolClassId: enrollment.schoolClassId,
    status: enrollment.status,
    approvedAt: enrollment.approvedAt?.toISOString() ?? null,
    approvedById: enrollment.approvedById,
    withdrawnAt: enrollment.withdrawnAt?.toISOString() ?? null,
    withdrawnById: enrollment.withdrawnById,
    createdAt: enrollment.createdAt.toISOString(),
    updatedAt: enrollment.updatedAt.toISOString(),
  })
}

function guardianResponse(guardian: Guardian, relationship: string) {
  return GuardianLinkSchema.parse({
    guardian: {
      id: guardian.id,
      name: guardian.name,
      phone: guardian.phone,
      email: guardian.email,
      createdAt: guardian.createdAt.toISOString(),
      updatedAt: guardian.updatedAt.toISOString(),
    },
    relationship,
  })
}

function candidateResponse(candidate: PossibleDuplicate) {
  return {
    id: candidate.id,
    studentReference: candidate.studentReference,
    givenName: candidate.givenName,
    familyName: candidate.familyName,
    dateOfBirth: candidate.dateOfBirth?.toISOString().slice(0, 10) ?? null,
  }
}

export function registerStudentRoutes(
  app: FastifyInstance,
  getStore: () => SchoolStore,
  getAccess: () => SchoolAccess,
  getStudents: () => StudentService,
  authenticate: preHandlerHookHandler,
) {
  async function requireSchool(userId: string, schoolId: string) {
    const school = await getStore().findSchoolById(schoolId)
    if (!school || !(await getAccess().canRegisterStudents(userId, school))) {
      throw new RecordNotFound('SCHOOL_NOT_FOUND')
    }
  }

  app.post(
    '/schools/:schoolId/students',
    { preHandler: authenticate },
    async (request, reply) => {
      const user = authenticatedUser(request)
      const { schoolId } = schoolParams.parse(request.params)
      await requireSchool(user.id, schoolId)
      const input = RegisterStudentSchema.parse(request.body)
      const result = await getStudents().register(schoolId, input)
      return reply.code(201).send(
        RegistrationResponseSchema.parse({
          student: studentResponse(result.student),
          enrollment: enrollmentResponse(result.enrollment),
          guardians: result.guardians.map(({ guardian, relationship }) =>
            guardianResponse(guardian, relationship),
          ),
          duplicateWarnings: {
            requiresHumanReview: true,
            candidates: result.possibleDuplicates.map(candidateResponse),
          },
        }),
      )
    },
  )

  app.get(
    '/schools/:schoolId/students',
    { preHandler: authenticate },
    async (request) => {
      const user = authenticatedUser(request)
      const { schoolId } = schoolParams.parse(request.params)
      await requireSchool(user.id, schoolId)
      const { limit, offset } = pagination.parse(request.query)
      const items = await getStudents().list(schoolId, limit, offset)
      return StudentListResponseSchema.parse({
        items: items.map(({ student, enrollment }) => ({
          student: studentResponse(student),
          enrollment: enrollmentResponse(enrollment),
        })),
        limit,
        offset,
      })
    },
  )

  app.get(
    '/schools/:schoolId/students/:studentId',
    { preHandler: authenticate },
    async (request) => {
      const user = authenticatedUser(request)
      const { schoolId, studentId } = studentParams.parse(request.params)
      await requireSchool(user.id, schoolId)
      const detail = await getStudents().find(schoolId, studentId)
      if (!detail) throw new RecordNotFound('STUDENT_NOT_FOUND')
      return StudentDetailResponseSchema.parse({
        student: studentResponse(detail.student),
        enrollments: detail.enrollments.map(enrollmentResponse),
        guardians: detail.guardians.map(({ guardian, relationship }) =>
          guardianResponse(guardian, relationship),
        ),
      })
    },
  )
}
