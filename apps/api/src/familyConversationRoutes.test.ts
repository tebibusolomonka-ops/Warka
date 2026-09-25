import Fastify from 'fastify'
import type { User } from '@warka/database'
import { describe, expect, it, vi } from 'vitest'
import { registerFamilyConversationRoutes } from './familyConversationRoutes.js'
import type { FamilyConversationService } from './familyConversationService.js'

const user = { id: '91c9a88f-1546-4ac6-9c9c-a9410f2f32bd' } as User
const schoolId = '9de96d93-c5ee-489d-bfd8-8e8b019858d6'
const otherSchoolId = 'dcd03188-ad59-46bc-a34e-9702b79d5dc2'
const conversationId = '926fbff5-4d40-40cd-bd32-f25b488b0fee'

function fixture() {
  const service = {
    teacherContacts: vi
      .fn()
      .mockResolvedValue([
        { id: 'teacher', displayName: 'Teacher', subject: 'Math' },
      ]),
    create: vi.fn().mockResolvedValue({
      id: conversationId,
      route: 'schoolOffice',
      status: 'open',
    }),
    listGuardian: vi.fn().mockResolvedValue([]),
    listSchool: vi.fn().mockResolvedValue([]),
    read: vi.fn().mockResolvedValue({
      conversation: {
        id: conversationId,
        schoolId,
        route: 'schoolOffice',
        status: 'open',
        escalatedAt: null,
        createdAt: new Date('2026-09-01'),
      },
      messages: [],
    }),
    send: vi.fn().mockResolvedValue({
      id: 'message',
      body: 'Reply',
      senderKind: 'school',
      createdAt: new Date('2026-09-01'),
    }),
    close: vi.fn().mockResolvedValue({ id: conversationId, status: 'closed' }),
    escalate: vi.fn().mockResolvedValue({
      id: conversationId,
      escalatedAt: new Date('2026-09-01'),
    }),
  } as unknown as FamilyConversationService
  const app = Fastify()
  registerFamilyConversationRoutes(
    app,
    () => service,
    async (request) => {
      request.currentUser = user
    },
  )
  app.setErrorHandler((_error, _request, reply) => {
    reply.code(400).send({ error: 'invalid' })
  })
  return { app, service }
}

describe('family conversation routes', () => {
  it('binds sender identity to the session and rejects arbitrary sender fields', async () => {
    const { app, service } = fixture()
    const created = await app.inject({
      method: 'POST',
      url: '/parent/conversations',
      payload: {
        studentReference: 'WKA-123',
        route: 'schoolOffice',
        body: 'Office question',
      },
    })
    expect(created.statusCode).toBe(201)
    expect(service.create).toHaveBeenCalledWith(user.id, {
      studentReference: 'WKA-123',
      route: 'schoolOffice',
      body: 'Office question',
    })
    const spoofed = await app.inject({
      method: 'POST',
      url: '/parent/conversations',
      payload: {
        studentReference: 'WKA-123',
        route: 'schoolOffice',
        body: 'Question',
        senderUserId: 'someone-else',
      },
    })
    expect(spoofed.statusCode).toBe(400)
    expect(service.create).toHaveBeenCalledTimes(1)
    const list = await app.inject({
      method: 'GET',
      url: '/parent/conversations?limit=2&offset=1',
    })
    expect(list.statusCode).toBe(200)
    expect(service.listGuardian).toHaveBeenCalledWith(user.id, 2, 1)
    await app.close()
  })

  it('checks the routed school before staff replies, closes, or escalates', async () => {
    const { app, service } = fixture()
    const wrong = await app.inject({
      method: 'POST',
      url: `/schools/${otherSchoolId}/family-conversations/${conversationId}/messages`,
      payload: { body: 'Reply' },
    })
    expect(wrong.statusCode).toBe(400)
    expect(service.send).not.toHaveBeenCalled()
    const reply = await app.inject({
      method: 'POST',
      url: `/schools/${schoolId}/family-conversations/${conversationId}/messages`,
      payload: { body: 'Reply' },
    })
    expect(reply.statusCode).toBe(201)
    expect(service.send).toHaveBeenCalledWith(user.id, conversationId, 'Reply')
    await app.inject({
      method: 'POST',
      url: `/schools/${schoolId}/family-conversations/${conversationId}/escalate`,
    })
    expect(service.escalate).toHaveBeenCalledWith(user.id, conversationId)
    await app.inject({
      method: 'POST',
      url: `/schools/${schoolId}/family-conversations/${conversationId}/close`,
    })
    expect(service.close).toHaveBeenCalledWith(user.id, conversationId)
    await app.close()
  })
})
