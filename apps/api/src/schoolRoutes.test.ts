import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import type { SchoolStore } from './schoolService.js'

function memoryStore(): SchoolStore {
  const organizations = new Map<
    string,
    Awaited<ReturnType<SchoolStore['createOrganization']>>
  >()
  const schools = new Map<
    string,
    Awaited<ReturnType<SchoolStore['createSchool']>>
  >()

  return {
    async createOrganization({ name }) {
      const organization = {
        id: randomUUID(),
        name,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      organizations.set(organization.id, organization)
      return organization
    },
    async findOrganizationById(id) {
      return organizations.get(id) ?? null
    },
    async createSchool({ organizationId, name }) {
      const school = {
        id: randomUUID(),
        organizationId,
        name,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      schools.set(school.id, school)
      return school
    },
    async findSchoolById(id) {
      return schools.get(id) ?? null
    },
    async listSchoolsForOrganization(organizationId) {
      return [...schools.values()].filter(
        (school) => school.organizationId === organizationId,
      )
    },
  }
}

describe('school routes', () => {
  it('creates an organization and a school, then retrieves the directory and school', async () => {
    const app = buildApp({ store: memoryStore() })

    try {
      const organizationResponse = await app.inject({
        method: 'POST',
        url: '/organizations',
        payload: { name: '  Regional office  ' },
      })
      expect(organizationResponse.statusCode).toBe(201)
      const organization = organizationResponse.json()
      expect(organization.name).toBe('Regional office')

      const schoolResponse = await app.inject({
        method: 'POST',
        url: `/organizations/${organization.id}/schools`,
        payload: { name: 'Central School' },
      })
      expect(schoolResponse.statusCode).toBe(201)
      const school = schoolResponse.json()
      expect(school.organizationId).toBe(organization.id)

      const list = await app.inject(`/organizations/${organization.id}/schools`)
      expect(list.statusCode).toBe(200)
      expect(list.json()).toEqual([school])

      const found = await app.inject(`/schools/${school.id}`)
      expect(found.statusCode).toBe(200)
      expect(found.json()).toEqual(school)
    } finally {
      await app.close()
    }
  })

  it('rejects invalid identifiers and request data', async () => {
    const app = buildApp({ store: memoryStore() })

    try {
      const invalidName = await app.inject({
        method: 'POST',
        url: '/organizations',
        payload: { name: ' ' },
      })
      expect(invalidName.statusCode).toBe(400)
      expect(invalidName.json().error.code).toBe('INVALID_REQUEST')

      const malformed = await app.inject({
        method: 'POST',
        url: '/organizations',
        payload: '{',
        headers: { 'content-type': 'application/json' },
      })
      expect(malformed.statusCode).toBe(400)
      expect(malformed.json().error.code).toBe('INVALID_REQUEST')

      const invalidId = await app.inject('/organizations/not-an-id/schools')
      expect(invalidId.statusCode).toBe(400)
      expect(invalidId.json().error.code).toBe('INVALID_REQUEST')
    } finally {
      await app.close()
    }
  })

  it('reports missing organizations and schools consistently', async () => {
    const app = buildApp({ store: memoryStore() })
    const missingId = randomUUID()

    try {
      const list = await app.inject(`/organizations/${missingId}/schools`)
      expect(list.statusCode).toBe(404)
      expect(list.json().error.code).toBe('ORGANIZATION_NOT_FOUND')

      const create = await app.inject({
        method: 'POST',
        url: `/organizations/${missingId}/schools`,
        payload: { name: 'Example' },
      })
      expect(create.statusCode).toBe(404)
      expect(create.json().error.code).toBe('ORGANIZATION_NOT_FOUND')

      const school = await app.inject(`/schools/${missingId}`)
      expect(school.statusCode).toBe(404)
      expect(school.json().error.code).toBe('SCHOOL_NOT_FOUND')
    } finally {
      await app.close()
    }
  })
})
