import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import type { Organization, School, User } from '@warka/database'
import { buildApp } from './app.js'
import type { AuthService } from './authService.js'
import type { SchoolAccess } from './schoolAccess.js'
import type { SchoolStore } from './schoolService.js'

const organization = {
  id: randomUUID(),
  name: 'First office',
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies Organization
const otherOrganization = {
  ...organization,
  id: randomUUID(),
  name: 'Other office',
}
const school = {
  id: randomUUID(),
  organizationId: organization.id,
  name: 'First school',
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies School
const secondSchool = { ...school, id: randomUUID(), name: 'Second school' }
const otherSchool = {
  ...school,
  id: randomUUID(),
  organizationId: otherOrganization.id,
  name: 'Other school',
}

const organizationRoles = new Map([
  [`owner:${organization.id}`, 'owner' as const],
  [`administrator:${organization.id}`, 'administrator' as const],
  [`outsider:${otherOrganization.id}`, 'owner' as const],
])
const schoolRoles = new Map([
  [`schoolAdministrator:${school.id}`, 'administrator'],
  [`registrar:${school.id}`, 'registrar'],
  [`teacher:${school.id}`, 'teacher'],
  [`approver:${school.id}`, 'approver'],
  [`assignedElsewhere:${secondSchool.id}`, 'teacher'],
])

function testApp() {
  const organizations = new Map([
    [organization.id, organization],
    [otherOrganization.id, otherOrganization],
  ])
  const schools = new Map([
    [school.id, school],
    [secondSchool.id, secondSchool],
    [otherSchool.id, otherSchool],
  ])
  const store: SchoolStore = {
    async findOrganizationById(id) {
      return organizations.get(id) ?? null
    },
    async createSchool({ organizationId, name }) {
      const created = {
        id: randomUUID(),
        organizationId,
        name,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      schools.set(created.id, created)
      return created
    },
    async findSchoolById(id) {
      return schools.get(id) ?? null
    },
    async listSchoolsForOrganization(organizationId) {
      return [...schools.values()].filter(
        (item) => item.organizationId === organizationId,
      )
    },
  }
  const auth: AuthService = {
    async login() {
      return null
    },
    async currentUser(token) {
      if (token === 'unknown') return null
      return {
        id: token,
        email: `${token}@example.test`,
        displayName: token,
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies User
    },
    async logout() {},
  }
  const access: Omit<SchoolAccess, 'canRegisterStudents'> = {
    async organizationsForUser(userId) {
      return [...organizationRoles.entries()]
        .filter(([key]) => key.startsWith(`${userId}:`))
        .map(([key, role]) => ({
          organization: organizations.get(key.split(':')[1]!)!,
          role,
        }))
    },
    async canManageOrganization(userId, organizationId) {
      return organizationRoles.has(`${userId}:${organizationId}`)
    },
    async canViewSchool(userId, item) {
      return (
        organizationRoles.has(`${userId}:${item.organizationId}`) ||
        schoolRoles.has(`${userId}:${item.id}`)
      )
    },
  }
  return buildApp({
    store,
    auth,
    access: { ...access, canRegisterStudents: async () => false },
  })
}

function cookie(userId: string) {
  return { cookie: `warka_session=${userId}` }
}

describe('protected school routes', () => {
  it('rejects anonymous requests and removes public organization creation', async () => {
    const app = testApp()
    try {
      for (const request of [
        app.inject('/organizations'),
        app.inject(`/organizations/${organization.id}/schools`),
        app.inject(`/schools/${school.id}`),
        app.inject({
          method: 'POST',
          url: `/organizations/${organization.id}/schools`,
          payload: { name: 'New' },
        }),
      ]) {
        expect((await request).statusCode).toBe(401)
      }
      const createOrganization = await app.inject({
        method: 'POST',
        url: '/organizations',
        payload: { name: 'Anonymous' },
      })
      expect(createOrganization.statusCode).toBe(404)
      expect(createOrganization.json().error.code).toBe('NOT_FOUND')
      const authenticatedCreate = await app.inject({
        method: 'POST',
        url: '/organizations',
        headers: cookie('owner'),
        payload: { name: 'More' },
      })
      expect(authenticatedCreate.statusCode).toBe(404)
    } finally {
      await app.close()
    }
  })

  it('lets organization owners and administrators manage their schools', async () => {
    const app = testApp()
    try {
      for (const userId of ['owner', 'administrator']) {
        const organizations = await app.inject({
          method: 'GET',
          url: '/organizations',
          headers: cookie(userId),
        })
        expect(organizations.statusCode).toBe(200)
        expect(organizations.json()).toEqual([
          {
            organization: {
              id: organization.id,
              name: organization.name,
              createdAt: organization.createdAt.toISOString(),
              updatedAt: organization.updatedAt.toISOString(),
            },
            role: userId,
          },
        ])

        const create = await app.inject({
          method: 'POST',
          url: `/organizations/${organization.id}/schools`,
          headers: cookie(userId),
          payload: { name: `New school for ${userId}` },
        })
        expect(create.statusCode).toBe(201)
        expect(create.json().organizationId).toBe(organization.id)
        const list = await app.inject({
          method: 'GET',
          url: `/organizations/${organization.id}/schools`,
          headers: cookie(userId),
        })
        expect(list.statusCode).toBe(200)
        expect(
          list.json().some((item: School) => item.id === create.json().id),
        ).toBe(true)
        const found = await app.inject({
          method: 'GET',
          url: `/schools/${school.id}`,
          headers: cookie(userId),
        })
        expect(found.statusCode).toBe(200)
      }
    } finally {
      await app.close()
    }
  })

  it('lets assigned staff view only their school without directory access', async () => {
    const app = testApp()
    try {
      for (const userId of [
        'schoolAdministrator',
        'registrar',
        'teacher',
        'approver',
      ]) {
        const found = await app.inject({
          method: 'GET',
          url: `/schools/${school.id}`,
          headers: cookie(userId),
        })
        expect(found.statusCode).toBe(200)
        const list = await app.inject({
          method: 'GET',
          url: `/organizations/${organization.id}/schools`,
          headers: cookie(userId),
        })
        expect(list.statusCode).toBe(404)
        const create = await app.inject({
          method: 'POST',
          url: `/organizations/${organization.id}/schools`,
          headers: cookie(userId),
          payload: { name: 'Forbidden' },
        })
        expect(create.statusCode).toBe(404)
        const organizations = await app.inject({
          method: 'GET',
          url: '/organizations',
          headers: cookie(userId),
        })
        expect(organizations.json()).toEqual([])
      }
    } finally {
      await app.close()
    }
  })

  it('hides schools from another organization and another school assignment', async () => {
    const app = testApp()
    try {
      const missing = await app.inject({
        method: 'GET',
        url: `/schools/${randomUUID()}`,
        headers: cookie('outsider'),
      })
      const privateSchool = await app.inject({
        method: 'GET',
        url: `/schools/${school.id}`,
        headers: cookie('outsider'),
      })
      expect(privateSchool.statusCode).toBe(404)
      expect(privateSchool.json()).toEqual(missing.json())

      const directory = await app.inject({
        method: 'GET',
        url: `/organizations/${organization.id}/schools`,
        headers: cookie('outsider'),
      })
      expect(directory.statusCode).toBe(404)
      const ownOrganizations = await app.inject({
        method: 'GET',
        url: '/organizations',
        headers: cookie('outsider'),
      })
      expect(
        ownOrganizations
          .json()
          .map(
            ({ organization: item }: { organization: Organization }) => item.id,
          ),
      ).toEqual([otherOrganization.id])

      const otherAssignment = await app.inject({
        method: 'GET',
        url: `/schools/${school.id}`,
        headers: cookie('assignedElsewhere'),
      })
      expect(otherAssignment.statusCode).toBe(404)
      const ownAssignment = await app.inject({
        method: 'GET',
        url: `/schools/${secondSchool.id}`,
        headers: cookie('assignedElsewhere'),
      })
      expect(ownAssignment.statusCode).toBe(200)
    } finally {
      await app.close()
    }
  })

  it('validates identifiers and request data for authenticated users', async () => {
    const app = testApp()
    try {
      const invalidId = await app.inject({
        method: 'GET',
        url: '/organizations/not-an-id/schools',
        headers: cookie('owner'),
      })
      expect(invalidId.statusCode).toBe(400)
      const invalidName = await app.inject({
        method: 'POST',
        url: `/organizations/${organization.id}/schools`,
        headers: cookie('owner'),
        payload: { name: ' ' },
      })
      expect(invalidName.statusCode).toBe(400)
    } finally {
      await app.close()
    }
  })
})
