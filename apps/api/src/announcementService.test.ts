import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import {
  AnnouncementAccessError,
  prismaAnnouncementService,
} from './announcementService.js'

const schoolId = randomUUID()
const classId = randomUUID()
const yearId = randomUUID()
const actorId = randomUUID()

function store(role: string | null, assigned = true) {
  return {
    school: {
      findUnique: vi.fn().mockResolvedValue({ organizationId: randomUUID() }),
    },
    organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    schoolMembership: {
      findUnique: vi.fn().mockResolvedValue(role ? { role } : null),
    },
    schoolClass: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: classId, academicYearId: yearId }),
    },
    teachingAssignment: {
      findFirst: vi
        .fn()
        .mockResolvedValue(assigned ? { id: randomUUID() } : null),
    },
    announcement: {
      create: vi.fn().mockImplementation(async ({ data }) => data),
      findMany: vi.fn().mockResolvedValue([]),
    },
    studentAccess: { findUnique: vi.fn().mockResolvedValue(null) },
    enrollment: { findFirst: vi.fn() },
  }
}

describe('announcements', () => {
  it('allows administrators to publish school notices and teachers only assigned class notices', async () => {
    const administrator = store('administrator', false)
    await prismaAnnouncementService(
      administrator as unknown as PrismaClient,
    ).create(actorId, schoolId, {
      title: 'School notice',
      body: 'Welcome',
      publish: true,
    })
    expect(administrator.announcement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId,
        schoolClassId: null,
        publishedAt: expect.any(Date),
      }),
    })
    const teacher = store('teacher')
    await prismaAnnouncementService(teacher as unknown as PrismaClient).create(
      actorId,
      schoolId,
      {
        schoolClassId: classId,
        title: 'Class notice',
        body: 'Read chapter one',
        publish: true,
      },
    )
    expect(teacher.teachingAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: actorId,
          schoolClassId: classId,
          academicYearId: yearId,
        }),
      }),
    )
    await expect(
      prismaAnnouncementService(teacher as unknown as PrismaClient).create(
        actorId,
        schoolId,
        { title: 'Forbidden', body: 'Text', publish: true },
      ),
    ).rejects.toBeInstanceOf(AnnouncementAccessError)
    for (const [role, assigned] of [
      ['teacher', false],
      ['registrar', true],
      ['approver', true],
      [null, true],
    ] as const) {
      await expect(
        prismaAnnouncementService(
          store(role, assigned) as unknown as PrismaClient,
        ).create(actorId, schoolId, {
          schoolClassId: classId,
          title: 'Forbidden',
          body: 'Text',
          publish: true,
        }),
      ).rejects.toBeInstanceOf(AnnouncementAccessError)
    }
  })

  it('filters the student feed by current approved enrollment, school, class, publication and expiry', async () => {
    const database = store(null)
    const studentId = randomUUID()
    database.studentAccess.findUnique.mockResolvedValue({ studentId })
    database.enrollment.findFirst.mockResolvedValue({
      schoolId,
      schoolClassId: classId,
    })
    database.announcement.findMany.mockResolvedValue([
      {
        id: randomUUID(),
        title: 'School notice',
        body: 'Welcome',
        publishedAt: new Date('2026-09-01'),
        schoolClass: null,
      },
      {
        id: randomUUID(),
        title: 'Class notice',
        body: 'Study',
        publishedAt: new Date('2026-09-02'),
        schoolClass: { name: 'A' },
      },
    ])
    const now = new Date('2026-09-24')
    const feed = await prismaAnnouncementService(
      database as unknown as PrismaClient,
    ).studentList(actorId, now)
    expect(feed).toMatchObject([
      { scope: { type: 'school' } },
      { scope: { type: 'class', name: 'A' } },
    ])
    expect(database.enrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId, status: 'approved' }),
      }),
    )
    expect(database.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          schoolId,
          publishedAt: { lte: now },
          AND: [
            { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
            { OR: [{ schoolClassId: null }, { schoolClassId: classId }] },
          ],
        },
      }),
    )
  })

  it('denies an unlinked user and keeps drafts in staff-only listings', async () => {
    const database = store('administrator')
    await expect(
      prismaAnnouncementService(
        database as unknown as PrismaClient,
      ).studentList(actorId),
    ).rejects.toBeInstanceOf(AnnouncementAccessError)
    expect(database.announcement.findMany).not.toHaveBeenCalled()
    await prismaAnnouncementService(database as unknown as PrismaClient).create(
      actorId,
      schoolId,
      { title: 'Draft', body: 'Later', publish: false },
    )
    expect(database.announcement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ publishedAt: null }),
    })
  })
})
