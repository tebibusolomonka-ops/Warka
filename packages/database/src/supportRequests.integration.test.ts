import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  CreateSupportRequestSchema,
  createSupportRequest,
  listSchoolSupportRequests,
  SupportRequestPermissionError,
} from './supportRequests.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('support requests in PostgreSQL', () => {
  it('keeps operational cases within the school', async () => {
    const suffix = randomUUID()
    const org = await database!.organization.create({
      data: { name: `Support ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: org.id, name: `Support School ${suffix}` },
    })
    const other = await database!.school.create({
      data: { organizationId: org.id, name: `Other School ${suffix}` },
    })
    const staff = await database!.user.create({
      data: {
        email: `support-staff-${suffix}@example.test`,
        displayName: 'Staff',
        schoolMemberships: { create: { schoolId: school.id, role: 'teacher' } },
      },
    })
    try {
      const request = await createSupportRequest(
        database!,
        staff.id,
        school.id,
        {
          category: 'technical',
          title: 'Cannot open records',
          description: 'The records page reports an error.',
        },
      )
      expect(request.status).toBe('open')
      expect(
        (await listSchoolSupportRequests(database!, staff.id, school.id)).map(
          (item) => item.id,
        ),
      ).toContain(request.id)
      await expect(
        listSchoolSupportRequests(database!, staff.id, other.id),
      ).rejects.toBeInstanceOf(SupportRequestPermissionError)
      expect(
        CreateSupportRequestSchema.safeParse({
          category: 'technical',
          title: '<script>',
          description: 'tiny',
        }).success,
      ).toBe(false)
    } finally {
      await database!.auditEvent.deleteMany({ where: { schoolId: school.id } })
      await database!.supportRequest.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.user.delete({ where: { id: staff.id } })
      await database!.school.deleteMany({
        where: { id: { in: [school.id, other.id] } },
      })
      await database!.organization.delete({ where: { id: org.id } })
    }
  })
})
