import Fastify from 'fastify'
import type { User } from '@warka/database'
import { describe, expect, it, vi } from 'vitest'
import { registerParentPortalRoutes } from './parentPortalRoutes.js'
import type { ParentAcademicService } from './parentAcademicService.js'
import type { ParentPortalService } from './parentPortalService.js'

const user = { id: '91c9a88f-1546-4ac6-9c9c-a9410f2f32bd' } as User

describe('parent academic routes', () => {
  it('dispatches each child resource under the authenticated user', async () => {
    const portal = {
      identity: vi.fn(),
      children: vi.fn(),
    } as ParentPortalService
    const academic = {
      results: vi.fn().mockResolvedValue([{ subject: 'Math' }]),
      announcements: vi.fn().mockResolvedValue([{ title: 'Notice' }]),
      materials: vi.fn().mockResolvedValue([{ title: 'Material' }]),
    } as unknown as ParentAcademicService
    const app = Fastify()
    registerParentPortalRoutes(
      app,
      () => portal,
      () => academic,
      async (request) => {
        request.currentUser = user
      },
    )
    for (const resource of ['results', 'announcements', 'materials'] as const) {
      const response = await app.inject({
        method: 'GET',
        url: `/parent/children/WKA-123/${resource}`,
      })
      expect(response.statusCode).toBe(200)
      expect(academic[resource]).toHaveBeenCalledWith(user.id, 'WKA-123')
    }
    await app.close()
  })
})
