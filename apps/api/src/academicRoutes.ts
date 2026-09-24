import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import {
  AssignTeacherSchema,
  CreateAssessmentSchema,
  CreateGradingPeriodSchema,
  CreateSubjectSchema,
  RecordMarkSchema,
  ResultContextSchema,
  SaveGradingSchemeSchema,
} from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import type { AcademicService } from './academicService.js'

const schoolParams = z.object({ schoolId: z.uuid() })
const markParams = schoolParams.extend({ markId: z.uuid() })
const assessmentParams = schoolParams.extend({ assessmentId: z.uuid() })
const resultSetParams = schoolParams.extend({ resultSetId: z.uuid() })
const publishedResultParams = schoolParams.extend({
  publishedResultId: z.uuid(),
})
const contextQuery = ResultContextSchema.omit({ schoolId: true })
const csvBody = z.object({ csv: z.string().min(1).max(1_000_000) })

function publicReview(
  review: Awaited<ReturnType<AcademicService['validateImport']>>,
) {
  return {
    valid: review.valid,
    rows: review.rows.map(({ line, studentReference, score, action }) => ({
      line,
      studentReference,
      score,
      action,
    })),
    problems: review.problems,
  }
}

export function registerAcademicRoutes(
  app: FastifyInstance,
  getAcademic: () => AcademicService,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/schools/:schoolId/academic-structure',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      return getAcademic().structure(authenticatedUser(request).id, schoolId)
    },
  )

  app.get(
    '/schools/:schoolId/subjects',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      return getAcademic().subjects(authenticatedUser(request).id, schoolId)
    },
  )

  app.post(
    '/schools/:schoolId/subjects',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = schoolParams.parse(request.params)
      const body = CreateSubjectSchema.omit({ schoolId: true }).parse(
        request.body,
      )
      return reply.code(201).send(
        await getAcademic().createSubject(authenticatedUser(request).id, {
          schoolId,
          ...body,
        }),
      )
    },
  )

  app.get(
    '/schools/:schoolId/teaching-assignments',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      return getAcademic().assignments(authenticatedUser(request).id, schoolId)
    },
  )

  app.post(
    '/schools/:schoolId/teaching-assignments',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = schoolParams.parse(request.params)
      const body = AssignTeacherSchema.omit({ schoolId: true }).parse(
        request.body,
      )
      return reply.code(201).send(
        await getAcademic().assignTeacher(authenticatedUser(request).id, {
          schoolId,
          ...body,
        }),
      )
    },
  )

  app.get(
    '/schools/:schoolId/grading-periods',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      const { academicYearId } = z
        .object({ academicYearId: z.uuid() })
        .parse(request.query)
      return getAcademic().periods(
        authenticatedUser(request).id,
        schoolId,
        academicYearId,
      )
    },
  )

  app.post(
    '/schools/:schoolId/grading-periods',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = schoolParams.parse(request.params)
      const body = CreateGradingPeriodSchema.omit({ schoolId: true }).parse(
        request.body,
      )
      return reply.code(201).send(
        await getAcademic().createPeriod(authenticatedUser(request).id, {
          schoolId,
          ...body,
        }),
      )
    },
  )

  app.get(
    '/schools/:schoolId/assessments',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      const context = contextQuery.parse(request.query)
      return getAcademic().assessments(authenticatedUser(request).id, {
        schoolId,
        ...context,
      })
    },
  )

  app.post(
    '/schools/:schoolId/assessments',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = schoolParams.parse(request.params)
      const body = CreateAssessmentSchema.omit({ schoolId: true }).parse(
        request.body,
      )
      return reply.code(201).send(
        await getAcademic().createAssessment(authenticatedUser(request).id, {
          schoolId,
          ...body,
        }),
      )
    },
  )

  app.get(
    '/schools/:schoolId/grading-scheme',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      return getAcademic().scheme(authenticatedUser(request).id, schoolId)
    },
  )

  app.put(
    '/schools/:schoolId/grading-scheme',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      const body = SaveGradingSchemeSchema.omit({ schoolId: true }).parse(
        request.body,
      )
      return getAcademic().saveScheme(authenticatedUser(request).id, {
        schoolId,
        ...body,
      })
    },
  )

  app.post(
    '/schools/:schoolId/marks',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = schoolParams.parse(request.params)
      const body = RecordMarkSchema.omit({ schoolId: true }).parse(request.body)
      return reply.code(201).send(
        await getAcademic().recordMark(authenticatedUser(request).id, {
          schoolId,
          ...body,
        }),
      )
    },
  )

  app.put(
    '/schools/:schoolId/marks/:markId',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, markId } = markParams.parse(request.params)
      const { score } = RecordMarkSchema.pick({ score: true }).parse(
        request.body,
      )
      return getAcademic().updateMark(
        authenticatedUser(request).id,
        schoolId,
        markId,
        score,
      )
    },
  )

  app.post(
    '/schools/:schoolId/assessments/:assessmentId/import/validate',
    { preHandler: authenticate, bodyLimit: 1_050_000 },
    async (request) => {
      const { schoolId, assessmentId } = assessmentParams.parse(request.params)
      const { csv } = csvBody.parse(request.body)
      return publicReview(
        await getAcademic().validateImport(
          authenticatedUser(request).id,
          schoolId,
          assessmentId,
          csv,
        ),
      )
    },
  )

  app.post(
    '/schools/:schoolId/assessments/:assessmentId/import/apply',
    { preHandler: authenticate, bodyLimit: 1_050_000 },
    async (request) => {
      const { schoolId, assessmentId } = assessmentParams.parse(request.params)
      const { csv } = csvBody.parse(request.body)
      return getAcademic().applyImport(
        authenticatedUser(request).id,
        schoolId,
        assessmentId,
        csv,
      )
    },
  )

  app.get(
    '/schools/:schoolId/results/preview',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      const context = contextQuery.parse(request.query)
      return getAcademic().preview(authenticatedUser(request).id, {
        schoolId,
        ...context,
      })
    },
  )

  app.post(
    '/schools/:schoolId/results/submit',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      const context = contextQuery.parse(request.body)
      return getAcademic().submit(authenticatedUser(request).id, {
        schoolId,
        ...context,
      })
    },
  )

  app.get(
    '/schools/:schoolId/result-sets/pending',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      return getAcademic().pending(authenticatedUser(request).id, schoolId)
    },
  )

  app.get(
    '/schools/:schoolId/result-sets/published',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      return getAcademic().published(authenticatedUser(request).id, schoolId)
    },
  )

  app.post(
    '/schools/:schoolId/result-sets/:resultSetId/publish',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, resultSetId } = resultSetParams.parse(request.params)
      return getAcademic().publish(
        authenticatedUser(request).id,
        schoolId,
        resultSetId,
      )
    },
  )

  app.post(
    '/schools/:schoolId/published-results/:publishedResultId/corrections',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, publishedResultId } = publishedResultParams.parse(
        request.params,
      )
      const { percentage, reason } = z
        .object({
          percentage: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/),
          reason: z.string().trim().min(5).max(500),
        })
        .parse(request.body)
      return getAcademic().correct(
        authenticatedUser(request).id,
        schoolId,
        publishedResultId,
        percentage,
        reason,
      )
    },
  )

  app.get(
    '/schools/:schoolId/published-results/:publishedResultId/corrections',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, publishedResultId } = publishedResultParams.parse(
        request.params,
      )
      return getAcademic().corrections(
        authenticatedUser(request).id,
        schoolId,
        publishedResultId,
      )
    },
  )
}
