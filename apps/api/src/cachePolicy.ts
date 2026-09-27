import { createHash } from 'node:crypto'
import type { FastifyInstance, onSendHookHandler } from 'fastify'
import { authenticatedUser } from './authenticateRequest.js'

export function installDefaultCachePolicy(app: FastifyInstance) {
  app.addHook('onSend', (_request, reply, payload, done) => {
    if (!reply.hasHeader('Cache-Control'))
      reply.header('Cache-Control', 'private, no-store')
    done(null, payload)
  })
}

export const privateConditionalCache: onSendHookHandler = (
  request,
  reply,
  payload,
  done,
) => {
  if (reply.statusCode !== 200 || payload == null || request.method !== 'GET')
    return done(null, payload)
  const actor = authenticatedUser(request)
  const etag = `"${createHash('sha256')
    .update(actor.id)
    .update('\0')
    .update(request.routeOptions.url ?? '')
    .update('\0')
    .update(Buffer.isBuffer(payload) ? payload : String(payload))
    .digest('hex')}"`
  reply.header('ETag', etag)
  reply.header('Cache-Control', 'private, max-age=0, must-revalidate')
  reply.header('Vary', 'Cookie')
  if (request.headers['if-none-match'] === etag) {
    reply.code(304)
    return done(null, null)
  }
  done(null, payload)
}
