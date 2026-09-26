import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

test('student requests a transcript, school issues it, and another student cannot download it', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const password = 'DocumentsPassphrase123!'
  const staffEmail = `documents-staff-${suffix}@example.test`
  const studentEmail = `documents-student-${suffix}@example.test`
  const otherEmail = `documents-other-${suffix}@example.test`
  let organizationId = '',
    schoolId = '',
    studentId = '',
    otherStudentId = '',
    staffId = '',
    studentUserId = '',
    otherUserId = ''
  try {
    const organization = await database.organization.create({
      data: { name: `Documents Organization ${suffix}` },
    })
    organizationId = organization.id
    const school = await database.school.create({
      data: { organizationId, name: `Documents School ${suffix}` },
    })
    schoolId = school.id
    const hash = await hashPassword(password)
    const staff = await database.user.create({
      data: {
        email: staffEmail,
        displayName: 'Documents Approver',
        passwordCredential: { create: { passwordHash: hash } },
        schoolMemberships: { create: { schoolId, role: 'administrator' } },
      },
    })
    staffId = staff.id
    const year = await database.academicYear.create({
      data: {
        schoolId,
        name: 'Documents Year',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    })
    const grade = await database.gradeLevel.create({
      data: { schoolId, name: 'Documents Grade' },
    })
    const schoolClass = await database.schoolClass.create({
      data: {
        schoolId,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        name: 'Documents Class',
      },
    })
    const subject = await database.subject.create({
      data: { schoolId, name: 'Mathematics' },
    })
    const period = await database.gradingPeriod.create({
      data: {
        schoolId,
        academicYearId: year.id,
        name: 'Term 1',
        startsOn: new Date('2026-01-01'),
        endsOn: new Date('2026-06-30'),
      },
    })
    const student = await database.student.create({
      data: {
        studentReference: `DOC-${suffix}`,
        givenName: 'Documents',
        familyName: 'Student',
      },
    })
    studentId = student.id
    const other = await database.student.create({
      data: {
        studentReference: `OTHER-${suffix}`,
        givenName: 'Other',
        familyName: 'Student',
      },
    })
    otherStudentId = other.id
    const enrollment = await database.enrollment.create({
      data: {
        schoolId,
        studentId,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        schoolClassId: schoolClass.id,
        status: 'approved',
        approvedAt: new Date(),
        approvedById: staffId,
      },
    })
    const resultSet = await database.resultSet.create({
      data: {
        schoolId,
        academicYearId: year.id,
        gradingPeriodId: period.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        status: 'published',
        publishedAt: new Date(),
        publishedById: staffId,
      },
    })
    await database.publishedResult.create({
      data: {
        schoolId,
        resultSetId: resultSet.id,
        studentId,
        enrollmentId: enrollment.id,
        percentage: 90,
        gradeLabel: 'A',
        currentPercentage: 90,
        currentGradeLabel: 'A',
      },
    })
    const studentUser = await database.user.create({
      data: {
        email: studentEmail,
        displayName: 'Documents Student',
        passwordCredential: { create: { passwordHash: hash } },
        studentAccess: { create: { studentId } },
      },
    })
    studentUserId = studentUser.id
    const otherUser = await database.user.create({
      data: {
        email: otherEmail,
        displayName: 'Other Student',
        passwordCredential: { create: { passwordHash: hash } },
        studentAccess: { create: { studentId: otherStudentId } },
      },
    })
    otherUserId = otherUser.id
    const signIn = async (email: string) => {
      await page.goto('/')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password', { exact: true }).fill(password)
      await page.getByRole('button', { name: 'Sign in' }).click()
    }
    const signOut = async () => {
      await page.getByRole('button', { name: 'Sign out' }).click()
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    }
    await signIn(studentEmail)
    await page.getByRole('button', { name: 'Documents' }).click()
    await page.getByLabel('Document type').selectOption('transcript')
    await page.getByRole('button', { name: 'Request document' }).click()
    await expect(page.getByText('Request submitted')).toBeVisible()
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Transcript — requested' }),
    ).toBeVisible()
    await signOut()
    await signIn(staffEmail)
    await expect(
      page.getByRole('heading', { name: 'My schools' }),
    ).toBeVisible()
    await page.getByLabel('School', { exact: true }).selectOption(schoolId)
    await page
      .getByRole('region', { name: 'School documents' })
      .getByRole('button', { name: 'Documents' })
      .click()
    await page
      .getByRole('button', { name: /Documents Student.*Transcript.*requested/ })
      .click()
    await page.getByRole('button', { name: 'Start processing' }).click()
    await expect(page.getByText('Processing started')).toBeVisible()
    await page
      .getByRole('button', {
        name: /Documents Student.*Transcript.*processing/,
      })
      .click()
    await page.getByRole('button', { name: 'Issue official document' }).click()
    await expect(page.getByText('Official document issued')).toBeVisible()
    const issued = await database.issuedDocument.findFirstOrThrow({
      where: { schoolId, studentId },
    })
    await signOut()
    await signIn(studentEmail)
    await page.getByRole('button', { name: 'Documents' }).click()
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Transcript — ready' }),
    ).toBeVisible()
    const download = page.waitForEvent('download')
    await page.getByRole('link', { name: 'Download PDF' }).click()
    expect((await download).suggestedFilename()).toMatch(/^warka-transcript-/)
    await signOut()
    await page.goto(`/verify/${issued.verificationReference}`)
    await expect(
      page.getByRole('heading', { name: 'Verified Warka record' }),
    ).toBeVisible()
    await signIn(otherEmail)
    const denied = await page.request.get(
      `/api/schools/${schoolId}/documents/${issued.id}/download`,
    )
    expect(denied.status()).toBe(404)
  } finally {
    if (schoolId) {
      await database.session.deleteMany({
        where: { userId: { in: [staffId, studentUserId, otherUserId] } },
      })
      await database.auditEvent.deleteMany({ where: { schoolId } })
      await database.documentRequest.deleteMany({ where: { schoolId } })
      await database.issuedDocument.deleteMany({ where: { schoolId } })
      await database.publishedResult.deleteMany({ where: { schoolId } })
      await database.resultSet.deleteMany({ where: { schoolId } })
      await database.enrollment.deleteMany({ where: { schoolId } })
      await database.gradingPeriod.deleteMany({ where: { schoolId } })
      await database.schoolClass.deleteMany({ where: { schoolId } })
      await database.subject.deleteMany({ where: { schoolId } })
      await database.gradeLevel.deleteMany({ where: { schoolId } })
      await database.academicYear.deleteMany({ where: { schoolId } })
      await database.schoolMembership.deleteMany({ where: { schoolId } })
      await database.studentAccess.deleteMany({
        where: { userId: { in: [studentUserId, otherUserId] } },
      })
      await database.passwordCredential.deleteMany({
        where: { userId: { in: [staffId, studentUserId, otherUserId] } },
      })
      await database.user.deleteMany({
        where: { id: { in: [staffId, studentUserId, otherUserId] } },
      })
      await database.school.delete({ where: { id: schoolId } })
    }
    if (studentId) await database.student.delete({ where: { id: studentId } })
    if (otherStudentId)
      await database.student.delete({ where: { id: otherStudentId } })
    if (organizationId)
      await database.organization.delete({ where: { id: organizationId } })
    await database.$disconnect()
  }
})
