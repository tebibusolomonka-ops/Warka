import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'
import { expectAccessiblePage } from './accessibility.js'

const operatorId = '717ac602-fd66-4400-9116-13a79b8cc3da'

test('staff provisions student portal access with official records', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const currentYear = new Date().getUTCFullYear()
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const schoolName = 'Browser School ' + suffix
  const receivingSchoolName = 'Receiving School ' + suffix
  const staffEmail = 'staff-' + suffix + '@example.test'
  const operatorEmail = 'scanner-operator-' + suffix + '@example.test'
  const teacherEmail = 'teacher-' + suffix + '@example.test'
  const otherEmail = 'other-' + suffix + '@example.test'
  const studentEmail = 'student-' + suffix + '@example.test'
  const staffPassword = 'StaffPassphrase123!'
  const initialPassword = 'InitialPassphrase123!'
  const newPassword = 'ChangedPassphrase123!'
  let schoolId = ''
  let receivingSchoolId = ''
  let studentId = ''
  let staffId = ''
  let teacherId = ''
  let otherUserId = ''
  let otherStudentId = ''
  let studentUserId = ''
  let organizationId = ''
  try {
    const organization = await database.organization.create({
      data: { name: 'Browser Organization ' + suffix },
    })
    organizationId = organization.id
    await database.user.create({
      data: {
        id: operatorId,
        email: operatorEmail,
        displayName: 'Scanner Operator',
        passwordCredential: {
          create: { passwordHash: await hashPassword(staffPassword) },
        },
        organizationMemberships: { create: { organizationId, role: 'owner' } },
      },
    })
    const school = await database.school.create({
      data: { organizationId, name: schoolName },
    })
    schoolId = school.id
    const receivingSchool = await database.school.create({
      data: { organizationId, name: receivingSchoolName },
    })
    receivingSchoolId = receivingSchool.id
    const staff = await database.user.create({
      data: {
        email: staffEmail,
        displayName: 'Browser Registrar',
        passwordCredential: {
          create: { passwordHash: await hashPassword(staffPassword) },
        },
        schoolMemberships: {
          create: { schoolId, role: 'administrator' },
        },
      },
    })
    staffId = staff.id
    await database.schoolMembership.create({
      data: {
        schoolId: receivingSchoolId,
        userId: staffId,
        role: 'administrator',
      },
    })
    await database.academicYear.create({
      data: {
        schoolId: receivingSchoolId,
        name: 'Receiving Year',
        startsOn: new Date(Date.UTC(currentYear, 0, 1)),
        endsOn: new Date(Date.UTC(currentYear, 11, 31)),
      },
    })
    await database.gradeLevel.create({
      data: { schoolId: receivingSchoolId, name: 'Receiving Grade' },
    })
    const year = await database.academicYear.create({
      data: {
        schoolId,
        name: 'Browser Year',
        startsOn: new Date(Date.UTC(currentYear, 0, 1)),
        endsOn: new Date(Date.UTC(currentYear, 11, 31)),
      },
    })
    const grade = await database.gradeLevel.create({
      data: { schoolId, name: 'Browser Grade' },
    })
    const schoolClass = await database.schoolClass.create({
      data: {
        schoolId,
        academicYearId: year.id,
        gradeLevelId: grade.id,
        name: 'Browser Class',
      },
    })
    const subject = await database.subject.create({
      data: { schoolId, name: 'Browser Mathematics' },
    })
    const teacher = await database.user.create({
      data: {
        email: teacherEmail,
        displayName: 'Browser Teacher',
        passwordCredential: {
          create: { passwordHash: await hashPassword(staffPassword) },
        },
        schoolMemberships: { create: { schoolId, role: 'teacher' } },
      },
    })
    teacherId = teacher.id
    await database.teachingAssignment.create({
      data: {
        schoolId,
        userId: teacherId,
        academicYearId: year.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
      },
    })
    const period = await database.gradingPeriod.create({
      data: {
        schoolId,
        academicYearId: year.id,
        name: 'Browser Term',
        startsOn: new Date(Date.UTC(currentYear, 0, 1)),
        endsOn: new Date(Date.UTC(currentYear, 5, 30)),
      },
    })
    const student = await database.student.create({
      data: {
        studentReference: 'BROWSER-' + suffix,
        givenName: 'Browser',
        familyName: 'Learner',
      },
    })
    studentId = student.id
    const other = await database.student.create({
      data: {
        studentReference: 'OTHER-BROWSER-' + suffix,
        givenName: 'Other',
        familyName: 'Learner',
      },
    })
    otherStudentId = other.id
    const receivingYear = await database.academicYear.findFirstOrThrow({
      where: { schoolId: receivingSchoolId },
    })
    const receivingGrade = await database.gradeLevel.findFirstOrThrow({
      where: { schoolId: receivingSchoolId },
    })
    await database.enrollment.create({
      data: {
        studentId: otherStudentId,
        schoolId: receivingSchoolId,
        academicYearId: receivingYear.id,
        gradeLevelId: receivingGrade.id,
        status: 'approved',
        approvedAt: new Date(),
        approvedById: staffId,
      },
    })
    const otherUser = await database.user.create({
      data: {
        email: otherEmail,
        displayName: 'Other Learner',
        passwordCredential: {
          create: { passwordHash: await hashPassword(staffPassword) },
        },
        studentAccess: { create: { studentId: otherStudentId } },
      },
    })
    otherUserId = otherUser.id
    const enrollment = await database.enrollment.create({
      data: {
        studentId,
        schoolId,
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
        percentage: 82,
        gradeLabel: 'B',
        currentPercentage: 82,
        currentGradeLabel: 'B',
      },
    })
    await database.learningMaterial.create({
      data: {
        schoolId,
        academicYearId: year.id,
        schoolClassId: schoolClass.id,
        subjectId: subject.id,
        title: 'Browser Algebra Guide',
        resourceType: 'link',
        resourceLocation: 'https://example.test/algebra',
        publishedAt: new Date(),
        createdById: staffId,
      },
    })
    await database.announcement.create({
      data: {
        schoolId,
        title: 'Browser Assembly',
        body: 'Meet in the hall.',
        publishedAt: new Date(),
        createdById: staffId,
      },
    })

    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(teacherEmail)
    await page.getByLabel('Password', { exact: true }).fill(staffPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByLabel('School', { exact: true }).selectOption(schoolId)
    await expect(
      page.getByRole('heading', { name: 'Publish learning material' }),
    ).toBeVisible()
    await page.getByLabel('Material source').selectOption('file')
    await page
      .getByRole('heading', { name: 'Publish learning material' })
      .locator('..')
      .getByLabel('Title')
      .fill('Browser PDF Worksheet')
    await page.getByLabel('PDF, text, PNG, or JPEG file').setInputFiles({
      name: 'worksheet.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\nsynthetic worksheet'),
    })
    await page.getByRole('button', { name: 'Publish material' }).click()
    await expect(page.getByText(/Material processing/)).toBeVisible()
    const uploaded = await database.learningMaterial.findFirstOrThrow({
      where: { schoolId, title: 'Browser PDF Worksheet' },
    })
    await expect
      .poll(
        async () =>
          (
            await database.fileAsset.findUnique({
              where: { learningMaterialId: uploaded.id },
            })
          )?.status,
      )
      .toBe('available')
    await page
      .getByRole('heading', { name: 'Publish learning material' })
      .locator('..')
      .getByLabel('Title')
      .fill('Controlled rejected worksheet')
    await page.getByLabel('PDF, text, PNG, or JPEG file').setInputFiles({
      name: 'rejected.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\nWARKA_CONTROLLED_INFECTED_FIXTURE\n'),
    })
    await page.getByRole('button', { name: 'Publish material' }).click()
    await expect(page.getByText(/Material processing/)).toBeVisible()
    const rejected = await database.learningMaterial.findFirstOrThrow({
      where: { schoolId, title: 'Controlled rejected worksheet' },
    })
    const rejectedAsset = await database.fileAsset.findUniqueOrThrow({
      where: { learningMaterialId: rejected.id },
    })
    await expect
      .poll(
        async () =>
          (
            await database.fileAsset.findUnique({
              where: { id: rejectedAsset.id },
            })
          )?.status,
      )
      .toBe('quarantined')
    expect(
      (
        await page.request.post(
          `/api/operations/file-security/assets/${rejectedAsset.id}/rescan`,
        )
      ).status(),
    ).toBe(403)
    await page.getByRole('button', { name: 'Sign out' }).click()

    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(operatorEmail)
    await page.getByLabel('Password', { exact: true }).fill(staffPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(
      page.getByRole('heading', { name: 'File security' }),
    ).toBeVisible()
    await expect(page.getByText(/rejected.pdf/)).toBeVisible()
    await page.getByRole('button', { name: 'Sign out' }).click()

    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(staffEmail)
    await page.getByLabel('Password', { exact: true }).fill(staffPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(
      page.getByRole('heading', { name: 'My schools' }),
    ).toBeVisible()
    await page.getByLabel('School', { exact: true }).selectOption(schoolId)
    await page.getByRole('button', { name: /Browser Learner/ }).click()
    await expect(
      page.getByRole('heading', { name: 'Portal access', exact: true }),
    ).toBeVisible()
    await page.getByLabel('Account email').fill(studentEmail)
    await page.getByLabel('Display name').fill('Browser Learner')
    await page.getByLabel('Initial password').fill(initialPassword)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Student account created.')).toBeVisible()
    const linked = await database.studentAccess.findUnique({
      where: { studentId },
    })
    expect(linked).not.toBeNull()
    studentUserId = linked!.userId
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect
      .poll(async () => (await page.request.get('/api/auth/me')).status())
      .toBe(401)
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await page.getByLabel('Email', { exact: true }).fill(studentEmail)
    await page.getByLabel('Password', { exact: true }).fill(initialPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(
      page.getByRole('heading', { name: 'Change your password' }),
    ).toBeVisible()
    await page.getByLabel('Current password').fill(initialPassword)
    await page.getByLabel('New password', { exact: true }).fill(newPassword)
    await page.getByLabel('Confirm new password').fill(newPassword)
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(
      page.getByRole('heading', { name: 'Student portal' }),
    ).toBeVisible()
    await expect(page).toHaveTitle('Student portal | Warka')
    await expect(page.locator('#main-content')).toBeFocused()
    await expectAccessiblePage(page)
    await expect(
      page.getByText('Student reference: BROWSER-' + suffix),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Staff workspace' }),
    ).toHaveCount(0)
    const adminResponse = await page.request.get(
      '/api/schools/' + schoolId + '/students',
    )
    expect(adminResponse.status()).toBe(404)
    await page.getByRole('button', { name: 'Results' }).click()
    await expect(page.getByText(/Browser Mathematics: 82%/)).toBeVisible()
    await page.getByRole('button', { name: 'Materials' }).click()
    await expect(page.getByText('Browser Algebra Guide')).toBeVisible()
    await expect(page.getByText('Browser PDF Worksheet')).toBeVisible()
    await expect(page.getByText('Controlled rejected worksheet')).toHaveCount(0)
    expect(
      (
        await page.request.get(
          `/api/schools/${schoolId}/materials/${rejected.id}/download`,
        )
      ).status(),
    ).toBe(404)
    const fileDownload = page.waitForEvent('download')
    await page.getByRole('link', { name: 'Download file' }).click()
    expect((await fileDownload).suggestedFilename()).toBe('worksheet.pdf')
    await page.getByRole('button', { name: 'Announcements' }).click()
    await expect(page.getByText('Browser Assembly')).toBeVisible()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect
      .poll(async () => (await page.request.get('/api/auth/me')).status())
      .toBe(401)
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await page.getByLabel('Email', { exact: true }).fill(otherEmail)
    await page.getByLabel('Password', { exact: true }).fill(staffPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(
      page.getByRole('heading', { name: 'Student portal' }),
    ).toBeVisible()
    expect(
      (
        await page.request.get(
          `/api/schools/${schoolId}/materials/${uploaded.id}/download`,
        )
      ).status(),
    ).toBe(404)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

    await page.getByLabel('Email', { exact: true }).fill(staffEmail)
    await page.getByLabel('Password', { exact: true }).fill(staffPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByLabel('School', { exact: true }).selectOption(schoolId)
    await page.getByRole('button', { name: /Browser Learner/ }).click()
    await expect(
      page.getByRole('heading', { name: 'Issued documents' }),
    ).toBeVisible()
    await page.getByLabel('Document type').selectOption('transcript')
    await page.getByRole('button', { name: 'Issue document' }).click()
    await expect(page.getByText('Document issued.')).toBeVisible()
    const issued = await database.issuedDocument.findFirst({
      where: { schoolId, studentId },
      orderBy: { issuedAt: 'desc' },
    })
    expect(issued).not.toBeNull()
    const reference = issued!.verificationReference
    await database.supportRequest.create({
      data: {
        schoolId,
        createdById: staffId,
        category: 'technical',
        title: 'Browser search support request',
        description: 'Synthetic issue for scoped search journey',
      },
    })
    const searchInput = page.getByLabel('Search this school')
    await page.keyboard.press('/')
    await expect(searchInput).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(searchInput).not.toBeFocused()
    await searchInput.fill('BROWSER-' + suffix)
    await expect(
      page
        .getByRole('region', { name: 'Students' })
        .getByRole('button', { name: /Browser Learner/ }),
    ).toBeVisible()
    await page
      .getByRole('region', { name: 'Students' })
      .getByRole('button', { name: /Browser Learner/ })
      .click()
    await expect(
      page
        .getByRole('region', { name: 'Selected search result' })
        .getByText(/Opened student/),
    ).toBeVisible()
    await searchInput.fill('OTHER-BROWSER-' + suffix)
    const isolated = await page.request.get(
      `/api/search?schoolId=${schoolId}&q=${encodeURIComponent('OTHER-BROWSER-' + suffix)}&types=student`,
    )
    expect(isolated.status()).toBe(200)
    expect((await isolated.json()).groups.student).toEqual([])
    await expect(
      page
        .getByRole('region', { name: 'Students' })
        .getByRole('button', { name: /Other Learner/ }),
    ).toHaveCount(0)
    await searchInput.fill(reference)
    await expect(
      page
        .getByRole('region', { name: 'Documents' })
        .getByRole('button', { name: /transcript/ }),
    ).toBeVisible()
    await page
      .getByRole('region', { name: 'Documents' })
      .getByRole('button', { name: /transcript/ })
      .click()
    await expect(
      page
        .getByRole('region', { name: 'Selected search result' })
        .getByText(/Opened issuedDocument/),
    ).toBeVisible()
    await searchInput.fill('Browser search support')
    await expect(
      page
        .getByRole('region', { name: 'Support' })
        .getByRole('button', { name: /Browser search support request/ }),
    ).toBeVisible()
    await page
      .getByRole('region', { name: 'Support' })
      .getByRole('button', { name: /Browser search support request/ })
      .click()
    await expect(
      page
        .getByRole('region', { name: 'Selected search result' })
        .getByText(/Opened supportRequest/),
    ).toBeVisible()
    await expect(
      page.getByText('Verification reference: ' + reference),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect
      .poll(async () => (await page.request.get('/api/auth/me')).status())
      .toBe(401)
    await page.goto('/verify/' + reference)
    await expect(
      page.getByRole('heading', { name: 'Verified Warka record' }),
    ).toBeVisible()
    await expect(page.getByText(schoolName)).toBeVisible()
    await expect(page.getByText('Browser Learner')).toBeVisible()
    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(staffEmail)
    await page.getByLabel('Password', { exact: true }).fill(staffPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByLabel('School', { exact: true }).selectOption(schoolId)
    await page.getByRole('button', { name: /Browser Learner/ }).click()
    await page.getByLabel('Reason for ' + reference).fill('Issued in error')
    await page.getByRole('button', { name: 'Withdraw document' }).click()
    await expect(page.getByText('Document withdrawn.')).toBeVisible()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect
      .poll(async () => (await page.request.get('/api/auth/me')).status())
      .toBe(401)
    await page.goto('/verify/' + reference)
    await expect(page.getByText(/document was withdrawn/i)).toBeVisible()

    await page.goto('/')
    await page.getByLabel('Email', { exact: true }).fill(staffEmail)
    await page.getByLabel('Password', { exact: true }).fill(staffPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByLabel('School', { exact: true }).selectOption(schoolId)
    await expect(page.getByRole('heading', { name: /Transfers/ })).toBeVisible()
    await page.getByLabel('Receiving school').selectOption(receivingSchoolId)
    await page.getByRole('button', { name: 'Request transfer' }).click()
    await expect(page.getByText('Transfer requested.')).toBeVisible()
    await page.getByRole('button', { name: 'Approve sending transfer' }).click()
    await expect(page.getByText('Transfer approved.')).toBeVisible()
    await page
      .getByLabel('School', { exact: true })
      .selectOption(receivingSchoolId)
    await page
      .getByRole('button', {
        name: 'Review incoming transfer for Browser Learner',
      })
      .click()
    await page.getByRole('button', { name: 'Accept transfer' }).click()
    await expect(page.getByText('Transfer accepted.')).toBeVisible()
    await expect(
      page.getByText(/Receiving Year · Receiving Grade · pending/),
    ).toBeVisible()
    await expect(
      page.getByText(/Browser Year · Browser Grade · withdrawn/),
    ).toBeVisible()
    await page.reload()
    await page
      .getByLabel('School', { exact: true })
      .selectOption(receivingSchoolId)
    await expect(
      page
        .locator('section[aria-labelledby="students-heading"]')
        .getByRole('button', { name: /Browser Learner/ }),
    ).toBeVisible()
    const transfer = await database.transferRequest.findFirst({
      where: { sendingSchoolId: schoolId, studentId },
    })
    expect(transfer?.status).toBe('acceptedByReceivingSchool')
    expect(transfer?.receivingEnrollmentId).toBeTruthy()
    expect(
      (
        await database.enrollment.findUnique({
          where: { id: enrollment.id },
        })
      )?.withdrawalReason,
    ).toBe('transfer')
    expect(
      (
        await database.enrollment.findUnique({
          where: { id: transfer!.receivingEnrollmentId! },
        })
      )?.status,
    ).toBe('pending')
  } finally {
    if (studentUserId) {
      await database.session.deleteMany({ where: { userId: studentUserId } })
      await database.studentAccess.deleteMany({
        where: { userId: studentUserId },
      })
      await database.passwordCredential.deleteMany({
        where: { userId: studentUserId },
      })
      await database.user.delete({ where: { id: studentUserId } })
    }
    if (schoolId) {
      await database.scheduledTaskExecution.deleteMany({
        where: {
          taskType: 'fileScan',
          resourceId: {
            in: (
              await database.fileScan.findMany({
                where: { fileAsset: { schoolId } },
                select: { id: true },
              })
            ).map((scan) => scan.id),
          },
        },
      })
      await database.fileScan.deleteMany({ where: { fileAsset: { schoolId } } })
      await database.session.deleteMany({
        where: { userId: { in: [teacherId, otherUserId] } },
      })
      await database.teachingAssignment.deleteMany({ where: { schoolId } })
      await database.auditEvent.deleteMany({ where: { schoolId } })
      await database.supportRequest.deleteMany({ where: { schoolId } })
      await database.fileAsset.deleteMany({ where: { schoolId } })
      await database.session.deleteMany({ where: { userId: staffId } })
      await database.transferRequest.deleteMany({
        where: { sendingSchoolId: schoolId },
      })
      await database.issuedDocument.deleteMany({ where: { schoolId } })
      await database.publishedResult.deleteMany({ where: { schoolId } })
      await database.resultSet.deleteMany({ where: { schoolId } })
      await database.learningMaterial.deleteMany({ where: { schoolId } })
      await database.announcement.deleteMany({ where: { schoolId } })
      await database.enrollment.deleteMany({
        where: { schoolId: { in: [schoolId, receivingSchoolId] } },
      })
      await database.gradingPeriod.deleteMany({ where: { schoolId } })
      await database.schoolClass.deleteMany({ where: { schoolId } })
      await database.subject.deleteMany({ where: { schoolId } })
      await database.gradeLevel.deleteMany({
        where: { schoolId: { in: [schoolId, receivingSchoolId] } },
      })
      await database.academicYear.deleteMany({
        where: { schoolId: { in: [schoolId, receivingSchoolId] } },
      })
      await database.schoolMembership.deleteMany({
        where: { schoolId: { in: [schoolId, receivingSchoolId] } },
      })
      await database.studentAccess.deleteMany({
        where: { userId: otherUserId },
      })
      await database.passwordCredential.deleteMany({
        where: { userId: { in: [teacherId, otherUserId] } },
      })
      await database.user.deleteMany({
        where: { id: { in: [teacherId, otherUserId] } },
      })
      await database.passwordCredential.deleteMany({
        where: { userId: staffId },
      })
      await database.user.delete({ where: { id: staffId } })
      await database.school.delete({ where: { id: receivingSchoolId } })
      await database.school.delete({ where: { id: schoolId } })
    }
    if (studentId) await database.student.delete({ where: { id: studentId } })
    if (otherStudentId)
      await database.student.delete({ where: { id: otherStudentId } })
    if (organizationId)
      await database.session.deleteMany({ where: { userId: operatorId } })
    if (organizationId)
      await database.notification.deleteMany({ where: { userId: operatorId } })
    if (organizationId)
      await database.organizationMembership.deleteMany({
        where: { userId: operatorId },
      })
    if (organizationId)
      await database.passwordCredential.deleteMany({
        where: { userId: operatorId },
      })
    if (organizationId)
      await database.user.deleteMany({ where: { id: operatorId } })
    if (organizationId)
      await database.organization.delete({ where: { id: organizationId } })
    await database.$disconnect()
  }
})
