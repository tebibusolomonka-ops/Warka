import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

test('school publishes a guardian event and records an RSVP without attendance', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const password = 'EventPassphrase123!'
  const adminEmail = `event-admin-${suffix}@example.test`
  const guardianEmail = `event-guardian-${suffix}@example.test`
  const unrelatedEmail = `event-unrelated-${suffix}@example.test`
  const organization = await database.organization.create({
    data: { name: `Events ${suffix}` },
  })
  const school = await database.school.create({
    data: { organizationId: organization.id, name: `Events school ${suffix}` },
  })
  const otherSchool = await database.school.create({
    data: { organizationId: organization.id, name: `Other school ${suffix}` },
  })
  const hash = await hashPassword(password)
  const users = []
  for (const email of [adminEmail, guardianEmail, unrelatedEmail])
    users.push(
      await database.user.create({
        data: {
          email,
          displayName: email,
          passwordCredential: { create: { passwordHash: hash } },
        },
      }),
    )
  const [admin, guardianUser, unrelatedUser] = users
  const guardian = await database.guardian.create({
    data: { name: 'Event guardian' },
  })
  const unrelatedGuardian = await database.guardian.create({
    data: { name: 'Unrelated guardian' },
  })
  const student = await database.student.create({
    data: { studentReference: `EVENT-${suffix}`, givenName: 'Hana' },
  })
  const unrelatedStudent = await database.student.create({
    data: { studentReference: `OTHER-EVENT-${suffix}`, givenName: 'Other' },
  })
  const year = new Date().getUTCFullYear()
  const signIn = async (email: string) => {
    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  }
  const signOut = async () => {
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  }
  try {
    await database.schoolMembership.create({
      data: {
        schoolId: school.id,
        userId: admin!.id,
        role: 'administrator',
        startsAt: new Date(`${year}-01-01`),
      },
    })
    await database.guardianAccess.createMany({
      data: [
        { userId: guardianUser!.id, guardianId: guardian.id },
        { userId: unrelatedUser!.id, guardianId: unrelatedGuardian.id },
      ],
    })
    await database.studentGuardian.createMany({
      data: [
        {
          studentId: student.id,
          guardianId: guardian.id,
          relationship: 'parent',
          verificationStatus: 'verified',
          verificationSchoolId: school.id,
          verifiedAt: new Date(),
        },
        {
          studentId: unrelatedStudent.id,
          guardianId: unrelatedGuardian.id,
          relationship: 'parent',
          verificationStatus: 'verified',
          verificationSchoolId: otherSchool.id,
          verifiedAt: new Date(),
        },
      ],
    })
    await database.schoolServiceAccess.createMany({
      data: [
        {
          schoolId: school.id,
          parentPortalEnabled: true,
          enabledAt: new Date(),
        },
        {
          schoolId: otherSchool.id,
          parentPortalEnabled: true,
          enabledAt: new Date(),
        },
      ],
    })
    for (const [targetSchool, targetStudent] of [
      [school, student],
      [otherSchool, unrelatedStudent],
    ] as const) {
      const academicYear = await database.academicYear.create({
        data: {
          schoolId: targetSchool.id,
          name: 'Current year',
          startsOn: new Date(`${year}-01-01`),
          endsOn: new Date(`${year + 1}-12-31`),
        },
      })
      const grade = await database.gradeLevel.create({
        data: { schoolId: targetSchool.id, name: 'Grade 6' },
      })
      const schoolClass = await database.schoolClass.create({
        data: {
          schoolId: targetSchool.id,
          academicYearId: academicYear.id,
          gradeLevelId: grade.id,
          name: 'A',
        },
      })
      await database.enrollment.create({
        data: {
          schoolId: targetSchool.id,
          studentId: targetStudent.id,
          academicYearId: academicYear.id,
          gradeLevelId: grade.id,
          schoolClassId: schoolClass.id,
          status: 'approved',
          approvedAt: new Date(`${year}-01-01`),
        },
      })
    }
    await signIn(adminEmail)
    const workspace = page.locator(
      'section[aria-labelledby="school-events-heading"]',
    )
    await expect(
      workspace.getByRole('heading', { name: 'School events' }),
    ).toBeVisible()
    await workspace.getByLabel('Title').fill(`Family open day ${suffix}`)
    await workspace.getByLabel('Description').fill('Visit the school hall')
    const startsAt = new Date(Date.now() + 3 * 86400000)
    const endsAt = new Date(startsAt.getTime() + 3600000)
    const localInput = (date: Date) =>
      new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    await workspace.getByLabel('Starts').fill(localInput(startsAt))
    await workspace.getByLabel('Ends').fill(localInput(endsAt))
    await workspace.getByLabel('School location').fill('School hall')
    await workspace.getByRole('button', { name: 'Save draft' }).click()
    await expect(workspace.getByText('Draft created.')).toBeVisible()
    const created = await database.schoolEvent.findFirstOrThrow({
      where: { schoolId: school.id, title: `Family open day ${suffix}` },
    })
    await workspace.getByLabel('Audience').selectOption('guardians')
    await workspace.getByRole('button', { name: 'Save audience' }).click()
    await expect(workspace.getByText('Audience saved.')).toBeVisible()
    await workspace.getByLabel('RSVP enabled').check()
    await workspace.getByRole('button', { name: 'Save RSVP setting' }).click()
    await expect(workspace.getByText('RSVP setting saved.')).toBeVisible()
    await workspace.getByRole('button', { name: 'Publish event' }).click()
    await expect(workspace.getByText('Event published.')).toBeVisible()
    await signOut()
    await signIn(guardianEmail)
    await page.getByRole('button', { name: 'Events' }).click()
    await expect(
      page.getByRole('heading', { name: 'Events for Hana' }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: `Family open day ${suffix}` })
      .click()
    await expect(page.getByText('Visit the school hall')).toBeVisible()
    const attendanceBefore = await database.studentAttendanceRecord.count({
      where: { schoolId: school.id },
    })
    await page.getByRole('button', { name: 'Going', exact: true }).click()
    await expect(page.getByText('RSVP saved.')).toBeVisible()
    expect(
      await database.studentAttendanceRecord.count({
        where: { schoolId: school.id },
      }),
    ).toBe(attendanceBefore)
    await signOut()
    await signIn(adminEmail)
    await workspace.getByLabel('Event').selectOption(created.id)
    await expect(workspace.getByText(/1 going, 0 not going/)).toBeVisible()
    await signOut()
    await signIn(unrelatedEmail)
    const denied = await page.request.get(
      `/api/parent/schools/${school.id}/children/${student.id}/events/${created.id}`,
    )
    expect(denied.status()).toBe(404)
    const deniedRsvp = await page.request.post(
      `/api/parent/schools/${school.id}/children/${student.id}/events/${created.id}/responses`,
      { data: { status: 'going' } },
    )
    expect(deniedRsvp.status()).toBe(404)
  } finally {
    const schoolIds = [school.id, otherSchool.id]
    const userIds = users.map((user) => user.id)
    await database.eventResponseHistory.deleteMany({
      where: { response: { schoolId: { in: schoolIds } } },
    })
    await database.eventResponse.deleteMany({
      where: { schoolId: { in: schoolIds } },
    })
    await database.schoolEventAudience.deleteMany({
      where: { schoolId: { in: schoolIds } },
    })
    await database.schoolEvent.deleteMany({
      where: { schoolId: { in: schoolIds } },
    })
    await database.enrollment.deleteMany({
      where: { schoolId: { in: schoolIds } },
    })
    await database.studentGuardian.deleteMany({
      where: { studentId: { in: [student.id, unrelatedStudent.id] } },
    })
    await database.guardianAccess.deleteMany({
      where: { userId: { in: userIds } },
    })
    await database.schoolMembership.deleteMany({
      where: { schoolId: { in: schoolIds } },
    })
    await database.schoolClass.deleteMany({
      where: { schoolId: { in: schoolIds } },
    })
    await database.gradeLevel.deleteMany({
      where: { schoolId: { in: schoolIds } },
    })
    await database.academicYear.deleteMany({
      where: { schoolId: { in: schoolIds } },
    })
    await database.schoolServiceAccess.deleteMany({
      where: { schoolId: { in: schoolIds } },
    })
    await database.session.deleteMany({ where: { userId: { in: userIds } } })
    await database.passwordCredential.deleteMany({
      where: { userId: { in: userIds } },
    })
    await database.student.deleteMany({
      where: { id: { in: [student.id, unrelatedStudent.id] } },
    })
    await database.guardian.deleteMany({
      where: { id: { in: [guardian.id, unrelatedGuardian.id] } },
    })
    await database.user.deleteMany({ where: { id: { in: userIds } } })
    await database.school.deleteMany({ where: { id: { in: schoolIds } } })
    await database.organization.delete({ where: { id: organization.id } })
    await database.$disconnect()
  }
})
