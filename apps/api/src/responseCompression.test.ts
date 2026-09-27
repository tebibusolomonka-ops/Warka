import { gunzipSync } from 'node:zlib'
import { Readable } from 'node:stream'
import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { registerResponseCompression } from './responseCompression.js'

describe('response compression', () => {
  it('compresses large JSON but leaves small responses and binary streams alone', async () => {
    const app = Fastify()
    registerResponseCompression(app)
    app.after(() => {
      app.get('/large', () => ({ text: 'Warka '.repeat(1000) }))
      app.get('/small', () => ({ text: 'ok' }))
      app.get('/pdf', { compress: false }, (_request, reply) =>
        reply
          .type('application/pdf')
          .send(Readable.from([Buffer.from('%PDF-1.7\n')])),
      )
      app.get('/png', { compress: false }, (_request, reply) =>
        reply.type('image/png').send(Buffer.from([137, 80, 78, 71])),
      )
    })
    await app.ready()
    const headers = { 'accept-encoding': 'gzip' }
    const large = await app.inject({ url: '/large', headers })
    expect(large.headers['content-encoding']).toBe('gzip')
    expect(
      JSON.parse(gunzipSync(large.rawPayload).toString('utf8')).text,
    ).toContain('Warka')
    expect(
      (await app.inject({ url: '/small', headers })).headers[
        'content-encoding'
      ],
    ).toBeUndefined()
    const pdf = await app.inject({ url: '/pdf', headers })
    expect(pdf.headers['content-encoding']).toBeUndefined()
    expect(pdf.rawPayload.toString()).toBe('%PDF-1.7\n')
    expect(
      (await app.inject({ url: '/png', headers })).headers['content-encoding'],
    ).toBeUndefined()
    await app.close()
  })
})
