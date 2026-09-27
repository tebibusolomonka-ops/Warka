import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { describe, expect, it, vi } from 'vitest'
import { registerSearchRoutes, unifiedSchoolSearch } from './searchRoutes.js'
import { SearchAccessError } from './schoolSearch.js'

const actorId = '11111111-1111-4111-8111-111111111111'
const schoolId = '22222222-2222-4222-8222-222222222222'
function fixture(
  search = vi
    .fn<typeof unifiedSchoolSearch>()
    .mockResolvedValue({ groups: { student: [] }, limit: 10, offset: 0 }),
) {
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerSearchRoutes(
    app,
    () => ({}) as PrismaClient,
    async (request, reply) => {
      if (!request.headers['x-user']) return reply.code(401).send()
      request.currentUser = { id: actorId } as User
    },
    search,
  )
  app.setErrorHandler((_error, _request, reply) => reply.code(400).send())
  return { app, search }
}
const url = `/search?schoolId=${schoolId}&q=Ada&types=student&limit=10&offset=0`
describe('unified search API', () => {
  it('requires authentication and validates bounded, whitelisted parameters', async () => {
    const { app, search } = fixture()
    expect((await app.inject(url)).statusCode).toBe(401)
    for (const bad of [
      `/search?schoolId=${schoolId}&q=x`,
      `/search?schoolId=${schoolId}&q=Ada&types=password`,
      `/search?schoolId=${schoolId}&q=Ada&limit=100`,
      `/search?schoolId=${schoolId}&q=Ada&offset=9999`,
    ])
      expect(
        (await app.inject({ url: bad, headers: { 'x-user': actorId } }))
          .statusCode,
      ).toBe(400)
    expect(search).not.toHaveBeenCalled()
    await app.close()
  })
  it('passes only safe parameters and uses private no-store cache policy', async () => {
    const { app, search } = fixture()
    const response = await app.inject({ url, headers: { 'x-user': actorId } })
    expect(response.statusCode).toBe(200)
    expect(response.headers['cache-control']).toBe('private, no-store')
    expect(search).toHaveBeenCalledWith(expect.anything(), {
      actorId,
      schoolId,
      query: 'Ada',
      types: ['student'],
      limit: 10,
      offset: 0,
    })
    await app.close()
  })
  it('denies unauthorized school scope and rate limits authenticated users', async () => {
    const denied = fixture(
      vi
        .fn<typeof unifiedSchoolSearch>()
        .mockRejectedValue(new SearchAccessError()),
    )
    expect(
      (await denied.app.inject({ url, headers: { 'x-user': actorId } }))
        .statusCode,
    ).toBe(403)
    await denied.app.close()
    const { app, search } = fixture()
    for (let index = 0; index < 30; index++)
      expect(
        (await app.inject({ url, headers: { 'x-user': actorId } })).statusCode,
      ).toBe(200)
    expect(
      (await app.inject({ url, headers: { 'x-user': actorId } })).statusCode,
    ).toBe(429)
    expect(search).toHaveBeenCalledTimes(30)
    await app.close()
  })
})
