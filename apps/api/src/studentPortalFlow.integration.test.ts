import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { setPassword } from '@warka/auth'
import { createDatabaseClient } from '@warka/database'
import { buildApp } from './app.js'
import { createAuthService } from './authService.js'
import { createSchoolAccess } from './schoolAccess.js'
import { prismaSchoolStore } from './schoolService.js'
import { prismaStudentAccountService } from './studentAccountService.js'
import { prismaStudentPortalService } from './studentPortalService.js'
import { prismaLearningMaterialService } from './learningMaterialService.js'
import { prismaAnnouncementService } from './announcementService.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null
afterAll(async () => {
  await database?.$disconnect()
})

function cookie(response: { headers: Record<string, unknown> }) {
  return { cookie: String(response.headers['set-cookie']).split(';')[0]! }
}

describe.skipIf(!database)('student portal workflow in PostgreSQL', () => {
  it('provisions, activates, reads own published content, and rejects staff and other-student access', async () => {
    const marker = randomUUID()
    const now = new Date()
    const startsOn = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const endsOn = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
    const organization = await database!.organization.create({
      data: { name: `Portal flow ${marker}` },
    })
    const school = await database!.school.create({
      data: { organizationId: organization.id, name: 'Test school' },
    })
    const staff = await database!.user.create({
      data: {
        email: `registrar-${marker}@example.test`,
        displayName: 'Registrar',
      },
    })
    await setPassword(database!, staff.id, 'registrar password')
    await database!.schoolMembership.create({
      data: { userId: staff.id, schoolId: school.id, role: 'registrar' },
    })
    const year = await database!.academicYear.create({
      data: { schoolId: school.id, name: 'Current year', startsOn, endsOn },
    })
    const grade = await database!.gradeLevel.create({
      data: { schoolId: school.id, name: 'Grade 1' },
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
      data: { schoolId: school.id, name: 'Math' },
    })
    const period = await database!.gradingPeriod.create({
      data: {
        schoolId: school.id,
        academicYearId: year.id,
        name: 'Term 1',
        startsOn,
        endsOn,
      },
    })
    const first = await database!.student.create({
      data: { studentReference: `WKA-${marker}-A`, givenName: 'Hana' },
    })
    const second = await database!.student.create({
      data: { studentReference: `WKA-${marker}-B`, givenName: 'Other' },
    })
    const enrollments = await Promise.all(
      [first, second].map((student) =>
        database!.enrollment.create({
          data: {
            studentId: student.id,
            schoolId: school.id,
            academicYearId: year.id,
            gradeLevelId: grade.id,
            schoolClassId: schoolClass.id,
            status: 'approved',
            approvedAt: now,
            approvedById: staff.id,
          },
        }),
      ),
    )
    const resultSet = await database!.resultSet.create({
      data: {
        schoolId: school.id,
        academicYearId: year.id,
        gradingPeriodId: period.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        status: 'published',
        publishedAt: now,
        publishedById: staff.id,
      },
    })
    await Promise.all(
      enrollments.map((enrollment, index) =>
        database!.publishedResult.create({
          data: {
            schoolId: school.id,
            resultSetId: resultSet.id,
            studentId: enrollment.studentId,
            enrollmentId: enrollment.id,
            percentage: index === 0 ? '91.00' : '45.00',
            gradeLabel: index === 0 ? 'A' : 'D',
            currentPercentage: index === 0 ? '91.00' : '45.00',
            currentGradeLabel: index === 0 ? 'A' : 'D',
          },
        }),
      ),
    )
    await database!.learningMaterial.create({
      data: {
        schoolId: school.id,
        academicYearId: year.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        title: 'Practice sheet',
        resourceType: 'link',
        resourceLocation: 'https://school.example.test/practice',
        publishedAt: now,
        createdById: staff.id,
      },
    })
    await database!.announcement.create({
      data: {
        schoolId: school.id,
        schoolClassId: schoolClass.id,
        title: 'Class notice',
        body: 'Read chapter one.',
        publishedAt: now,
        createdById: staff.id,
      },
    })
    const app = buildApp({
      auth: createAuthService(database!),
      access: createSchoolAccess(database!),
      store: prismaSchoolStore(database!),
      studentAccounts: prismaStudentAccountService(database!),
      studentPortal: prismaStudentPortalService(database!),
      materials: prismaLearningMaterialService(database!),
      announcements: prismaAnnouncementService(database!),
    })
    const studentEmail = `hana-${marker}@example.test`
    try {
      const staffLogin = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: staff.email, password: 'registrar password' },
      })
      expect(staffLogin.statusCode).toBe(200)
      const staffCookie = cookie(staffLogin)
      const accessPath = `/schools/${school.id}/students/${first.id}/access`
      const provision = await app.inject({
        method: 'POST',
        url: accessPath,
        headers: staffCookie,
        payload: {
          email: studentEmail,
          displayName: 'Hana',
          initialPassword: 'initial password',
        },
      })
      expect(provision.statusCode).toBe(201)
      expect(provision.body).not.toContain('initial password')
      expect(
        (
          await app.inject({
            method: 'GET',
            url: accessPath,
            headers: staffCookie,
          })
        ).json(),
      ).toMatchObject({ status: 'active', mustChangePassword: true })
      const studentLogin = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: studentEmail, password: 'initial password' },
      })
      expect(studentLogin.statusCode).toBe(200)
      const studentCookie = cookie(studentLogin)
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/auth/me',
            headers: studentCookie,
          })
        ).json().mustChangePassword,
      ).toBe(true)
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/student/me',
            headers: studentCookie,
          })
        ).statusCode,
      ).toBe(403)
      const change = await app.inject({
        method: 'POST',
        url: '/auth/change-password',
        headers: studentCookie,
        payload: {
          currentPassword: 'initial password',
          newPassword: 'new strong password',
        },
      })
      expect(change.statusCode).toBe(204)
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/auth/me',
            headers: studentCookie,
          })
        ).json().mustChangePassword,
      ).toBe(false)
      const identity = await app.inject({
        method: 'GET',
        url: '/student/me',
        headers: studentCookie,
      })
      expect(identity.json()).toMatchObject({
        studentReference: first.studentReference,
        currentEnrollment: {
          school: school.name,
          schoolClass: schoolClass.name,
        },
      })
      const results = await app.inject({
        method: 'GET',
        url: `/student/results?studentId=${second.id}`,
        headers: studentCookie,
      })
      expect(results.json()).toMatchObject([
        { subject: 'Math', percentage: 91 },
      ])
      expect(results.json()).toHaveLength(1)
      const materials = await app.inject({
        method: 'GET',
        url: '/student/materials',
        headers: studentCookie,
      })
      expect(materials.json()).toMatchObject([
        { title: 'Practice sheet', subject: 'Math' },
      ])
      const announcements = await app.inject({
        method: 'GET',
        url: '/student/announcements',
        headers: studentCookie,
      })
      expect(announcements.json()).toMatchObject([
        { title: 'Class notice', scope: { type: 'class', name: 'A' } },
      ])
      for (const [method, url] of [
        ['GET', `/schools/${school.id}/students`],
        ['GET', `/schools/${school.id}/materials`],
        ['GET', `/schools/${school.id}/announcements`],
        ['POST', accessPath],
      ] as const) {
        const denied = await app.inject({
          method,
          url,
          headers: studentCookie,
          ...(method === 'POST'
            ? {
                payload: {
                  email: `other-${marker}@example.test`,
                  displayName: 'Other',
                  initialPassword: 'another password',
                },
              }
            : {}),
        })
        expect(denied.statusCode).toBe(404)
      }
      const materialWrite = await app.inject({
        method: 'POST',
        url: `/schools/${school.id}/materials`,
        headers: studentCookie,
        payload: {
          academicYearId: year.id,
          schoolClassId: schoolClass.id,
          subjectId: subject.id,
          title: 'Forbidden',
          resourceType: 'link',
          resourceLocation: 'https://school.example.test/file',
          publish: true,
        },
      })
      expect(materialWrite.statusCode).toBe(404)
      const announcementWrite = await app.inject({
        method: 'POST',
        url: `/schools/${school.id}/announcements`,
        headers: studentCookie,
        payload: { title: 'Forbidden', body: 'Text', publish: true },
      })
      expect(announcementWrite.statusCode).toBe(404)
    } finally {
      await app.close()
      await database!.session.deleteMany({
        where: { user: { email: { in: [staff.email, studentEmail] } } },
      })
      await database!.publishedResult.deleteMany({
        where: { resultSetId: resultSet.id },
      })
      await database!.resultSet.delete({ where: { id: resultSet.id } })
      await database!.learningMaterial.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.announcement.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.enrollment.deleteMany({ where: { schoolId: school.id } })
      await database!.studentAccess.deleteMany({
        where: { studentId: { in: [first.id, second.id] } },
      })
      await database!.schoolMembership.deleteMany({
        where: { schoolId: school.id },
      })
      await database!.user.deleteMany({
        where: { email: { in: [staff.email, studentEmail] } },
      })
      await database!.student.deleteMany({
        where: { id: { in: [first.id, second.id] } },
      })
      await database!.gradingPeriod.delete({ where: { id: period.id } })
      await database!.subject.delete({ where: { id: subject.id } })
      await database!.schoolClass.delete({ where: { id: schoolClass.id } })
      await database!.gradeLevel.delete({ where: { id: grade.id } })
      await database!.academicYear.delete({ where: { id: year.id } })
      await database!.school.delete({ where: { id: school.id } })
      await database!.organization.delete({ where: { id: organization.id } })
    }
  })
})
