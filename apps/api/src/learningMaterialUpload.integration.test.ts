import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from '@warka/database'
import { LocalFileStorage } from './fileStorage.js'
import { prismaLearningMaterialService } from './learningMaterialService.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('learning material file in PostgreSQL', () => {
  it('persists a validated artifact for a publishable material', async () => {
    const suffix = randomUUID()
    const root = await mkdtemp(join(tmpdir(), 'warka-learning-file-'))
    const organization = await database!.organization.create({
      data: { name: `Learning file ${suffix}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'Learning file school' },
    })
    const year = await database!.academicYear.create({
      data: {
        schoolId: school.id,
        name: 'Year',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    })
    const grade = await database!.gradeLevel.create({
      data: { schoolId: school.id, name: 'Grade' },
    })
    const schoolClass = await database!.schoolClass.create({
      data: {
        schoolId: school.id,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        name: 'A',
      },
    })
    const subject = await database!.subject.create({
      data: { schoolId: school.id, name: 'Mathematics' },
    })
    const actor = await database!.user.create({
      data: {
        email: `learning-file-${suffix}@example.test`,
        displayName: 'Learning file administrator',
        schoolMemberships: {
          create: { schoolId: school.id, role: 'administrator' },
        },
      },
    })
    const service = prismaLearningMaterialService(
      database!,
      new LocalFileStorage(root),
    )
    let materialId = ''
    try {
      const material = (await service.create(actor.id, school.id, {
        academicYearId: year.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        title: 'Synthetic lesson',
        resourceType: 'file',
        publish: false,
      })) as { id: string }
      materialId = material.id
      const bytes = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n')
      const uploaded = (await service.upload(actor.id, school.id, material.id, {
        bytes,
        originalFileName: 'lesson.pdf',
        claimedContentType: 'application/pdf',
      })) as { id: string }
      const asset = await database!.fileAsset.findUniqueOrThrow({
        where: { id: uploaded.id },
      })
      expect(asset.status).toBe('available')
      expect(asset.learningMaterialId).toBe(material.id)
      expect(await new LocalFileStorage(root).exists(asset.storageKey)).toBe(
        true,
      )
      await service.publish(actor.id, school.id, material.id)
      expect(
        (
          await database!.learningMaterial.findUniqueOrThrow({
            where: { id: material.id },
          })
        ).publishedAt,
      ).not.toBeNull()
      await new LocalFileStorage(root).delete(asset.storageKey)
    } finally {
      if (materialId) {
        await database!.fileAsset.deleteMany({
          where: { learningMaterialId: materialId },
        })
        await database!.learningMaterial.delete({ where: { id: materialId } })
      }
      await database!.subject.delete({ where: { id: subject.id } })
      await database!.schoolClass.delete({ where: { id: schoolClass.id } })
      await database!.gradeLevel.delete({ where: { id: grade.id } })
      await database!.academicYear.delete({ where: { id: year.id } })
      await database!.schoolMembership.deleteMany({
        where: { userId: actor.id },
      })
      await database!.user.delete({ where: { id: actor.id } })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
      if (resolve(root).startsWith(resolve(tmpdir()) + sep))
        await rm(root, { recursive: true, force: true })
    }
  })
})
