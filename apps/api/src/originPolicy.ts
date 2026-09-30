import cors from '@fastify/cors'
import type { FastifyInstance } from 'fastify'
import { environmentProfile } from './environmentProfile.js'

export function trustedOrigins(env: NodeJS.ProcessEnv) {
  const candidates = (env.WARKA_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (env.PUBLIC_BASE_URL) candidates.push(new URL(env.PUBLIC_BASE_URL).origin)
  const production = environmentProfile(env).name === 'production'
  return new Set(
    candidates.map((candidate) => {
      const url = new URL(candidate)
      if (
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
      )
        throw new Error(
          'Trusted origins must contain only scheme, host, and optional port',
        )
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        (production && url.protocol !== 'https:')
      )
        throw new Error('Trusted origin scheme is not allowed')
      return url.origin
    }),
  )
}

export function registerOriginPolicy(
  app: FastifyInstance,
  env: NodeJS.ProcessEnv = process.env,
) {
  const allowed = trustedOrigins(env)
  app.register(cors, {
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin(origin, callback) {
      callback(null, !origin || allowed.has(origin))
    },
    strictPreflight: true,
  })
}
