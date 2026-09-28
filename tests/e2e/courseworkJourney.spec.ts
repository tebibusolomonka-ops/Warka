import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createDatabaseClient } from '../../packages/database/dist/index.js'
import { hashPassword } from '../../packages/auth/dist/index.js'

test('coursework submission, feedback, explicit mark transfer and access boundaries', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const database = createDatabaseClient({
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  } as NodeJS.ProcessEnv)
  const suffix = randomUUID()
  const schoolId = randomUUID()
  const organizationId = randomUUID()
  const userIds: string[] = []
  const studentIds: string[] = []
  const year = new Date().getUTCFullYear()
  const password = 'CourseworkPassphrase123!'
  const teacherEmail = `coursework-teacher-${suffix}@example.test`
  const studentEmail = `coursework-student-${suffix}@example.test`
  const otherEmail = `coursework-other-${suffix}@example.test`
  const otherTeacherEmail = `coursework-other-teacher-${suffix}@example.test`
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
  const post = async (path: string, data?: unknown) =>
    page.request.post(`/api${path}`, data === undefined ? {} : { data })
  const put = async (path: string, data: unknown) =>
    page.request.put(`/api${path}`, { data })
  try {
    await database.organization.create({
      data: { id: organizationId, name: `Coursework ${suffix}` },
    })
    await database.school.create({
      data: { id: schoolId, organizationId, name: 'Coursework School' },
    })
    const hash = await hashPassword(password)
    const users = []
    for (const [email, role] of [
      [teacherEmail, 'teacher'],
      [otherTeacherEmail, 'teacher'],
      [studentEmail, null],
      [otherEmail, null],
    ] as const) {
      const user = await database.user.create({
        data: {
          email,
          displayName: email,
          passwordCredential: { create: { passwordHash: hash } },
          ...(role
            ? {
                schoolMemberships: {
                  create: {
                    schoolId,
                    role,
                    startsAt: new Date(`${year}-01-01`),
                  },
                },
              }
            : {}),
        },
      })
      users.push(user)
      userIds.push(user.id)
    }
    const [teacher, , studentUser, otherUser] = users
    const academicYear = await database.academicYear.create({
      data: {
        schoolId,
        name: 'Coursework year',
        startsOn: new Date(`${year}-01-01`),
        endsOn: new Date(`${year}-12-31`),
      },
    })
    const grade = await database.gradeLevel.create({
      data: { schoolId, name: 'Grade 7' },
    })
    const classA = await database.schoolClass.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        gradeLevelId: grade.id,
        name: 'A',
      },
    })
    const classB = await database.schoolClass.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        gradeLevelId: grade.id,
        name: 'B',
      },
    })
    const subject = await database.subject.create({
      data: { schoolId, name: 'Mathematics' },
    })
    const period = await database.gradingPeriod.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        name: 'Term',
        startsOn: new Date(`${year}-01-01`),
        endsOn: new Date(`${year}-12-31`),
      },
    })
    await database.teachingAssignment.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        schoolClassId: classA.id,
        subjectId: subject.id,
        userId: teacher!.id,
        startsAt: new Date(`${year}-01-01`),
      },
    })
    const assessment = await database.assessment.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        gradingPeriodId: period.id,
        schoolClassId: classA.id,
        subjectId: subject.id,
        name: 'Coursework assessment',
        maximumScore: '20',
        weight: '100',
        position: 0,
      },
    })
    for (const [index, schoolClass] of [classA, classB].entries()) {
      const student = await database.student.create({
        data: {
          studentReference: `CW-${index}-${suffix}`,
          givenName: `Learner ${index}`,
        },
      })
      studentIds.push(student.id)
      await database.enrollment.create({
        data: {
          schoolId,
          studentId: student.id,
          academicYearId: academicYear.id,
          gradeLevelId: grade.id,
          schoolClassId: schoolClass.id,
          status: 'approved',
          approvedAt: new Date(),
        },
      })
      await database.studentAccess.create({
        data: {
          userId: (index === 0 ? studentUser : otherUser)!.id,
          studentId: student.id,
        },
      })
    }
    await signIn(teacherEmail)
    const root = `/schools/${schoolId}/coursework`
    const created = await post(root, {
      academicYearId: academicYear.id,
      gradingPeriodId: period.id,
      schoolClassId: classA.id,
      subjectId: subject.id,
      assessmentId: assessment.id,
      title: 'Coursework journey essay',
      instructions: 'Write a short response.',
      dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    })
    expect(created.status()).toBe(201)
    const assignment = (await created.json()) as { id: string }
    const path = `${root}/${assignment.id}`
    const safeBytes = Buffer.from('Safe coursework source text')
    const upload = await post(`${path}/attachments`, {
      originalFileName: 'source.txt',
      contentType: 'text/plain',
      base64: safeBytes.toString('base64'),
    })
    expect(upload.status()).toBe(201)
    const teacherAttachment = (await upload.json()) as {
      id: string
      fileAssetId: string
    }
    await expect
      .poll(
        async () =>
          (
            await database.fileAsset.findUnique({
              where: { id: teacherAttachment.fileAssetId },
            })
          )?.status,
      )
      .toBe('available')
    const rubric = await post(`${path}/rubric`, {
      title: 'Essay rubric',
      criteria: [
        {
          title: 'Reasoning',
          description: 'Explains the answer',
          maxPoints: '10',
        },
      ],
    })
    expect(rubric.status()).toBe(201)
    const rubricValue = (await rubric.json()) as { criteria: { id: string }[] }
    expect((await post(`${path}/publish`)).status()).toBe(200)
    await signOut()
    await signIn(otherEmail)
    expect(
      (
        await page.request.get(`/api/student/coursework/${assignment.id}`)
      ).status(),
    ).toBe(404)
    await signOut()
    await signIn(studentEmail)
    await page.getByRole('button', { name: 'Coursework' }).click()
    await expect(
      page.getByRole('button', { name: 'Coursework journey essay' }),
    ).toBeVisible()
    const studentDetail = await page.request.get(
      `/api/student/coursework/${assignment.id}`,
    )
    expect(studentDetail.status()).toBe(200)
    const detail = (await studentDetail.json()) as {
      attachments: { id: string }[]
    }
    expect(
      (
        await page.request.get(
          `/api${path}/attachments/${detail.attachments[0]!.id}/download`,
        )
      ).status(),
    ).toBe(200)
    const started = await post(
      `/student/coursework/${assignment.id}/submission`,
      {},
    )
    expect(started.status()).toBe(201)
    const draft = await put(
      `/student/coursework/${assignment.id}/submission/draft`,
      { textResponse: 'My original answer' },
    )
    expect(draft.status()).toBe(200)
    const revision = (await draft.json()) as { id: string }
    const studentFile = await post(
      `/student/coursework/${assignment.id}/revisions/${revision.id}/attachments`,
      {
        originalFileName: 'answer.txt',
        contentType: 'text/plain',
        base64: Buffer.from('Safe answer attachment').toString('base64'),
      },
    )
    expect(studentFile.status()).toBe(201)
    const studentAttachment = (await studentFile.json()) as {
      fileAssetId: string
    }
    expect(
      (
        await post(`/student/coursework/${assignment.id}/submission/submit`)
      ).status(),
    ).toBe(200)
    const submittedAt = (
      await database.submissionRevision.findUniqueOrThrow({
        where: { id: revision.id },
      })
    ).submittedAt
    await expect
      .poll(
        async () =>
          (
            await database.fileAsset.findUnique({
              where: { id: studentAttachment.fileAssetId },
            })
          )?.status,
      )
      .toBe('available')
    expect(
      (
        await database.submissionRevision.findUniqueOrThrow({
          where: { id: revision.id },
        })
      ).submittedAt,
    ).toEqual(submittedAt)
    await signOut()
    await signIn(otherTeacherEmail)
    expect(
      (
        await post(`${path}/revisions/${revision.id}/review`, {
          status: 'reviewed',
        })
      ).status(),
    ).toBeGreaterThanOrEqual(400)
    await signOut()
    await signIn(teacherEmail)
    const reviewPath = `${path}/revisions/${revision.id}`
    expect(
      (await post(`${reviewPath}/review`, { status: 'reviewed' })).status(),
    ).toBe(200)
    expect(
      (
        await post(`${reviewPath}/rubric-scores`, {
          criteria: [{ criterionId: rubricValue.criteria[0]!.id, points: '8' }],
        })
      ).status(),
    ).toBe(201)
    expect(
      (
        await put(`${reviewPath}/feedback`, { text: 'Strong reasoning.' })
      ).status(),
    ).toBe(200)
    const entry = await database.markEntryWindow.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        gradingPeriodId: period.id,
        assessmentId: assessment.id,
        createdById: teacher!.id,
        opensAt: new Date(Date.now() - 3600000),
        closesAt: new Date(Date.now() + 3600000),
        status: 'closed',
      },
    })
    expect(
      (await post(`${reviewPath}/transfer-mark`)).status(),
    ).toBeGreaterThanOrEqual(400)
    await database.markEntryWindow.update({
      where: { id: entry.id },
      data: { status: 'open' },
    })
    const lock = await database.gradebookLock.create({
      data: {
        schoolId,
        academicYearId: academicYear.id,
        gradingPeriodId: period.id,
        schoolClassId: classA.id,
        subjectId: subject.id,
        locked: true,
        lockedAt: new Date(),
      },
    })
    expect(
      (await post(`${reviewPath}/transfer-mark`)).status(),
    ).toBeGreaterThanOrEqual(400)
    await database.gradebookLock.update({
      where: { id: lock.id },
      data: { locked: false },
    })
    const transfer = await post(`${reviewPath}/transfer-mark`)
    expect(transfer.status()).toBe(201)
    const transferred = (await transfer.json()) as {
      mark: { id: string; score: string }
    }
    expect(Number(transferred.mark.score)).toBe(16)
    expect(
      (await post(`${reviewPath}/transfer-mark`)).status(),
    ).toBeGreaterThanOrEqual(400)
    expect(
      await database.mark.count({
        where: { schoolId, assessmentId: assessment.id },
      }),
    ).toBe(1)
    const gradebook = await page.request.get(
      `/api/schools/${schoolId}/gradebook?${new URLSearchParams({ academicYearId: academicYear.id, gradingPeriodId: period.id, schoolClassId: classA.id, subjectId: subject.id })}`,
    )
    expect(gradebook.status()).toBe(200)
    expect(JSON.stringify(await gradebook.json())).toContain(
      transferred.mark.id,
    )
    expect(await database.publishedResult.count({ where: { schoolId } })).toBe(
      0,
    )
    expect((await post(`${reviewPath}/feedback/release`)).status()).toBe(200)
    await signOut()
    await signIn(studentEmail)
    await page.getByRole('button', { name: 'Coursework' }).click()
    await page.getByRole('button', { name: 'Coursework journey essay' }).click()
    await expect(
      page.getByText('Teacher feedback: Strong reasoning.'),
    ).toBeVisible()
    await expect(page.getByText(/Released rubric result: 8/)).toBeVisible()
    await database.fileAsset.update({
      where: { id: teacherAttachment.fileAssetId },
      data: { status: 'quarantined' },
    })
    expect(
      (
        await page.request.get(
          `/api${path}/attachments/${detail.attachments[0]!.id}/download`,
        )
      ).status(),
    ).toBeGreaterThanOrEqual(400)
  } finally {
    await database.courseworkMarkTransfer.deleteMany({ where: { schoolId } })
    await database.mark.deleteMany({ where: { schoolId } })
    await database.gradebookLock.deleteMany({ where: { schoolId } })
    await database.markEntryWindow.deleteMany({ where: { schoolId } })
    await database.rubricCriterionScore.deleteMany({
      where: { score: { revision: { submission: { schoolId } } } },
    })
    await database.rubricScore.deleteMany({
      where: { revision: { submission: { schoolId } } },
    })
    await database.courseworkFeedback.deleteMany({
      where: { revision: { submission: { schoolId } } },
    })
    await database.submissionReview.deleteMany({
      where: { revision: { submission: { schoolId } } },
    })
    await database.submissionAttachment.deleteMany({ where: { schoolId } })
    await database.submissionRevision.deleteMany({
      where: { submission: { schoolId } },
    })
    await database.courseworkSubmission.deleteMany({ where: { schoolId } })
    await database.courseworkAttachment.deleteMany({ where: { schoolId } })
    await database.assignmentExtension.deleteMany({ where: { schoolId } })
    await database.rubricCriterion.deleteMany({
      where: { rubric: { schoolId } },
    })
    await database.courseworkRubric.deleteMany({ where: { schoolId } })
    await database.courseworkAssignment.deleteMany({ where: { schoolId } })
    await database.fileScan.deleteMany({ where: { fileAsset: { schoolId } } })
    await database.fileAsset.deleteMany({ where: { schoolId } })
    await database.assessment.deleteMany({ where: { schoolId } })
    await database.enrollment.deleteMany({ where: { schoolId } })
    await database.gradingPeriod.deleteMany({ where: { schoolId } })
    await database.teachingAssignment.deleteMany({ where: { schoolId } })
    await database.subject.deleteMany({ where: { schoolId } })
    await database.schoolClass.deleteMany({ where: { schoolId } })
    await database.gradeLevel.deleteMany({ where: { schoolId } })
    await database.academicYear.deleteMany({ where: { schoolId } })
    await database.notification.deleteMany({
      where: { userId: { in: userIds } },
    })
    await database.auditEvent.deleteMany({
      where: { actorUserId: { in: userIds } },
    })
    await database.session.deleteMany({ where: { userId: { in: userIds } } })
    await database.studentAccess.deleteMany({
      where: { userId: { in: userIds } },
    })
    await database.passwordCredential.deleteMany({
      where: { userId: { in: userIds } },
    })
    await database.schoolMembership.deleteMany({
      where: { userId: { in: userIds } },
    })
    await database.user.deleteMany({ where: { id: { in: userIds } } })
    await database.student.deleteMany({ where: { id: { in: studentIds } } })
    await database.school.deleteMany({ where: { id: schoolId } })
    await database.organization.deleteMany({ where: { id: organizationId } })
    await database.$disconnect()
  }
})
