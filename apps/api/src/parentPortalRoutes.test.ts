import Fastify from 'fastify'
import type { User } from '@warka/database'
import { describe, expect, it, vi } from 'vitest'
import { registerParentPortalRoutes } from './parentPortalRoutes.js'
import type { ParentPortalService } from './parentPortalService.js'

const user = { id: '91c9a88f-1546-4ac6-9c9c-a9410f2f32bd' } as User

describe('parent portal identity routes', () => {
  it('uses the authenticated identity without a client guardian ID', async () => {
    const portal: ParentPortalService = {
      identity: vi.fn().mockResolvedValue({ displayName: 'Martha' }),
      children: vi.fn().mockResolvedValue([
        {
          studentReference: 'WKA-123',
          displayName: 'Child',
          schoolId: 'school',
          school: 'School',
          academicYear: 'Year',
          gradeLevel: 'Grade',
          schoolClass: null,
          relationship: 'Parent',
        },
      ]),
    }
    const app = Fastify()
    registerParentPortalRoutes(
      app,
      () => portal,
      async (request) => {
        request.currentUser = user
      },
    )
    const me = await app.inject({ method: 'GET', url: '/parent/me' })
    const children = await app.inject({
      method: 'GET',
      url: '/parent/children',
    })
    expect(me.json()).toEqual({ displayName: 'Martha' })
    expect(children.json()).toHaveLength(1)
    expect(portal.identity).toHaveBeenCalledWith(user.id)
    expect(portal.children).toHaveBeenCalledWith(user.id)
    await app.close()
  })
})
