import compress from '@fastify/compress'
import type { FastifyInstance } from 'fastify'

export function registerResponseCompression(app: FastifyInstance) {
  app.register(compress, {
    global: true,
    threshold: 1024,
    encodings: ['gzip', 'br'],
  })
}
