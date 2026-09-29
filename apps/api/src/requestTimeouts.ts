import type { FastifyInstance } from 'fastify'

type TimeoutCategory = 'interactive' | 'background' | 'fileStream'

export function requestTimeoutConfiguration(
  env: NodeJS.ProcessEnv = process.env,
) {
  const parse = (name: string, fallback: number) => {
    const value = Number(env[name] ?? fallback)
    if (!Number.isInteger(value) || value < 10 || value > 300_000)
      throw new Error(`Invalid ${name}`)
    return value
  }
  return {
    interactiveMs: parse('WARKA_REQUEST_TIMEOUT_MS', 15_000),
    backgroundMs: parse('WARKA_BACKGROUND_REQUEST_TIMEOUT_MS', 60_000),
  }
}

export function timeoutCategory(
  method: string,
  route: string,
): TimeoutCategory {
  const normalized = route.toLowerCase()
  if (
    normalized.includes('download') ||
    normalized.includes('/files/') ||
    normalized.includes('/stream')
  )
    return 'fileStream'
  if (
    method !== 'GET' &&
    (normalized.startsWith('/operations/') ||
      normalized.includes('/rehearsal') ||
      normalized.includes('/runs'))
  )
    return 'background'
  return 'interactive'
}

export function installRequestTimeouts(
  app: FastifyInstance,
  config = requestTimeoutConfiguration(),
) {
  const timers = new WeakMap<object, ReturnType<typeof setTimeout>>()
  app.addHook('onRequest', async (request, reply) => {
    const category = timeoutCategory(
      request.method,
      request.routeOptions.url ?? request.url.split('?')[0]!,
    )
    if (category === 'fileStream') return
    const timeoutMs =
      category === 'background' ? config.backgroundMs : config.interactiveMs
    const timer = setTimeout(() => {
      if (reply.sent) return
      void reply.code(504).send({
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'The request exceeded its processing time limit',
        },
      })
    }, timeoutMs)
    timer.unref()
    timers.set(request, timer)
  })
  const clear = async (request: object) => {
    const timer = timers.get(request)
    if (timer) clearTimeout(timer)
    timers.delete(request)
  }
  app.addHook('onResponse', clear)
  app.addHook('onError', clear)
}
