import type { FastifyInstance } from 'fastify'
import { DocumentVerificationSchema } from '@warka/shared'
import type { DocumentVerificationService } from './documentVerificationService.js'

const referencePattern = /^WRK-[A-F0-9]{32}$/

export function registerDocumentVerificationRoutes(
  app: FastifyInstance,
  getVerification: () => DocumentVerificationService,
) {
  const attempts = new Map<string, { count: number; resetAt: number }>()
  app.get('/verify/documents/:reference', async (request, reply) => {
    const now = Date.now()
    const key = request.ip
    const previous = attempts.get(key)
    if (previous && previous.resetAt > now && previous.count >= 30) {
      reply.header(
        'Retry-After',
        String(Math.ceil((previous.resetAt - now) / 1000)),
      )
      return reply.code(429).send({ status: 'unavailable' })
    }
    if (!previous || previous.resetAt <= now) {
      if (attempts.size >= 10000) {
        for (const [ip, entry] of attempts)
          if (entry.resetAt <= now) attempts.delete(ip)
      }
      if (!attempts.has(key) && attempts.size >= 10000)
        return reply.code(429).send({ status: 'unavailable' })
      attempts.set(key, { count: 1, resetAt: now + 60_000 })
    } else {
      previous.count += 1
    }
    const reference = (request.params as { reference: string }).reference
    if (!referencePattern.test(reference))
      return DocumentVerificationSchema.parse({ status: 'unavailable' })
    return DocumentVerificationSchema.parse(
      await getVerification().verify(reference),
    )
  })
}
