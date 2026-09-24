import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import { createOrganization } from './organizations.js'
import { createSchool } from './schools.js'
import { getGradingScheme, saveGradingScheme } from './grading.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('grading scheme in PostgreSQL', () => {
  it('persists a school scheme with deterministic band ordering and isolation', async () => {
    const organization = await createOrganization(database!, {
      name: 'Synthetic grading organization',
    })
    const school = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Synthetic grading school',
    })
    const otherSchool = await createSchool(database!, {
      organizationId: organization.id,
      name: 'Other synthetic grading school',
    })
    try {
      const saved = await saveGradingScheme(database!, {
        schoolId: school.id,
        bands: [
          { label: 'Lower', minimumPercentage: '0' },
          { label: 'Upper', minimumPercentage: '80' },
          { label: 'Middle', minimumPercentage: '50' },
        ],
      })
      expect(saved.bands.map((band) => band.label)).toEqual([
        'Upper',
        'Middle',
        'Lower',
      ])
      expect(
        (await getGradingScheme(database!, school.id))?.bands,
      ).toHaveLength(3)
      expect(await getGradingScheme(database!, otherSchool.id)).toBeNull()
      const replaced = await saveGradingScheme(database!, {
        schoolId: school.id,
        bands: [
          { label: 'Pass', minimumPercentage: '60' },
          { label: 'Else', minimumPercentage: '0' },
        ],
      })
      expect(replaced.id).toBe(saved.id)
      expect(replaced.bands.map((band) => band.label)).toEqual(['Pass', 'Else'])
    } finally {
      await database!.gradeBand.deleteMany({
        where: { gradingScheme: { schoolId: school.id } },
      })
      await database!.gradingScheme.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.school.deleteMany({
        where: { organizationId: organization.id },
      })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
