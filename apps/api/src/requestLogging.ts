import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'

export type RequestLog = {
  correlationId: string
  method: string
  route: string
  statusCode: number
  durationMs: number
  actorId?: string
}

export function safeCorrelationId(value: unknown) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value)
    ? value
    : randomUUID()
}

export function writeRequestLog(entry: RequestLog) {
  process.stdout.write(`${JSON.stringify(entry)}\n`)
}

export function installRequestLogging(
  app: FastifyInstance,
  write: (entry: RequestLog) => void = writeRequestLog,
) {
  const started = new WeakMap<object, number>()
  const ids = new WeakMap<object, string>()
  app.addHook('onRequest', async (request, reply) => {
    const id = safeCorrelationId(request.headers['x-correlation-id'])
    ids.set(request, id)
    started.set(request, performance.now())
    reply.header('x-correlation-id', id)
  })
  app.addHook('onResponse', async (request, reply) => {
    write({
      correlationId: ids.get(request) ?? randomUUID(),
      method: request.method,
      route: request.routeOptions.url ?? 'unmatched',
      statusCode: reply.statusCode,
      durationMs: Math.max(
        0,
        Math.round(
          performance.now() - (started.get(request) ?? performance.now()),
        ),
      ),
      ...(request.currentUser?.id ? { actorId: request.currentUser.id } : {}),
    })
  })
}
