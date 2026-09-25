import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { getParentPortalSetting, setParentPortalEnabled } from '@warka/database'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerParentServiceRoutes } from './parentServiceRoutes.js'

vi.mock('@warka/database', () => ({
  getParentPortalSetting: vi.fn(),
  setParentPortalEnabled: vi.fn(),
}))

const user = { id: '91c9a88f-1546-4ac6-9c9c-a9410f2f32bd' } as User
const schoolId = '9de96d93-c5ee-489d-bfd8-8e8b019858d6'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('parent portal school routes', () => {
  it('reads the setting for the authenticated operator', async () => {
    vi.mocked(getParentPortalSetting).mockResolvedValue({
      parentPortalEnabled: false,
      enabledAt: null,
    })
    const app = Fastify()
    registerParentServiceRoutes(
      app,
      () => ({}) as PrismaClient,
      async (request) => {
        request.currentUser = user
      },
    )
    const response = await app.inject({
      method: 'GET',
      url: `/schools/${schoolId}/parent-portal`,
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      parentPortalEnabled: false,
      enabledAt: null,
    })
    expect(getParentPortalSetting).toHaveBeenCalledWith(
      expect.anything(),
      user.id,
      schoolId,
    )
    await app.close()
  })

  it('accepts only an explicit boolean setting', async () => {
    vi.mocked(setParentPortalEnabled).mockResolvedValue({
      parentPortalEnabled: true,
      enabledAt: new Date('2026-01-01T00:00:00Z'),
    } as Awaited<ReturnType<typeof setParentPortalEnabled>>)
    const app = Fastify()
    registerParentServiceRoutes(
      app,
      () => ({}) as PrismaClient,
      async (request) => {
        request.currentUser = user
      },
    )
    const response = await app.inject({
      method: 'PUT',
      url: `/schools/${schoolId}/parent-portal`,
      payload: { parentPortalEnabled: true },
    })
    expect(response.statusCode).toBe(200)
    expect(setParentPortalEnabled).toHaveBeenCalledWith(
      expect.anything(),
      user.id,
      schoolId,
      true,
    )
    await app.close()
  })
})
