import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import {
  findSchoolMembership,
  findStudentAccessForUser,
  hasOrganizationAdminRole,
  mayManageClassSubject,
  mayManageCourseworkAssignment,
  mayViewSchoolEvent,
  visibleCourseworkAssignmentForStudent,
} from '@warka/database'
import { eligibleParentChildren } from './parentPortalService.js'
import { prismaDocumentDownloadService } from './documentDownloadService.js'
import {
  FileAssetAccessError,
  requireFileAssetAccess,
} from './fileAssetAccess.js'

vi.mock('@warka/database', async (importOriginal) => {
  const original = await importOriginal<typeof import('@warka/database')>()
  return {
    ...original,
    findSchoolMembership: vi.fn(),
    findStudentAccessForUser: vi.fn(),
    hasOrganizationAdminRole: vi.fn(),
    mayManageClassSubject: vi.fn(),
    mayManageCourseworkAssignment: vi.fn(),
    mayViewSchoolEvent: vi.fn(),
    visibleCourseworkAssignmentForStudent: vi.fn(),
  }
})
vi.mock('./parentPortalService.js', () => ({ eligibleParentChildren: vi.fn() }))
vi.mock('./documentDownloadService.js', () => ({
  prismaDocumentDownloadService: vi.fn(),
}))

const actorId = '3e480e62-47d7-4525-9d88-b8891e56fac0'
const assetId = '4e480e62-47d7-4525-9d88-b8891e56fac0'
const schoolId = '5e480e62-47d7-4525-9d88-b8891e56fac0'
const materialId = '6e480e62-47d7-4525-9d88-b8891e56fac0'

function fixture(
  purpose:
    | 'learningMaterial'
    | 'issuedDocument'
    | 'schoolBranding'
    | 'courseworkAssignment'
    | 'courseworkSubmission'
    | 'eventAttachment' = 'learningMaterial',
) {
  const asset = {
    id: assetId,
    purpose,
    status: 'available',
    schoolId,
    learningMaterialId: purpose === 'learningMaterial' ? materialId : null,
    issuedDocumentId: purpose === 'issuedDocument' ? materialId : null,
    storageKey: 'asset_private',
    scanRequired:
      purpose === 'courseworkAssignment' ||
      purpose === 'courseworkSubmission' ||
      purpose === 'eventAttachment',
  }
  const database = {
    user: {
      findUnique: vi.fn().mockResolvedValue({ accountStatus: 'active' }),
    },
    fileAsset: { findUnique: vi.fn().mockResolvedValue(asset) },
    fileScan: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ status: 'clean', result: 'clean' }),
    },
    courseworkAttachment: {
      findUnique: vi.fn().mockResolvedValue({
        assignmentId: materialId,
        schoolId,
        removedAt: null,
        assignment: { id: materialId, status: 'published' },
      }),
    },
    submissionAttachment: {
      findUnique: vi.fn().mockResolvedValue({
        schoolId,
        removedAt: null,
        revision: {
          submittedAt: null,
          submission: {
            schoolId,
            studentId: materialId,
            assignmentId: materialId,
            assignment: { id: materialId },
          },
        },
      }),
    },
    eventAttachment: {
      findUnique: vi.fn().mockResolvedValue({
        schoolId,
        eventId: materialId,
        removedAt: null,
        event: { status: 'published' },
      }),
    },
    learningMaterial: {
      findUnique: vi.fn().mockResolvedValue({
        id: materialId,
        schoolId,
        academicYearId: 'year',
        schoolClassId: 'class',
        subjectId: 'subject',
        publishedAt: new Date('2026-01-01'),
      }),
    },
    enrollment: { findFirst: vi.fn().mockResolvedValue(null) },
    issuedDocument: { findUnique: vi.fn().mockResolvedValue({ schoolId }) },
    school: {
      findUnique: vi.fn().mockResolvedValue({ organizationId: 'organization' }),
    },
  } as unknown as PrismaClient
  return { database, asset }
}

beforeEach(() => {
  vi.mocked(findSchoolMembership).mockReset().mockResolvedValue(null)
  vi.mocked(findStudentAccessForUser).mockReset().mockResolvedValue(null)
  vi.mocked(hasOrganizationAdminRole).mockReset().mockResolvedValue(false)
  vi.mocked(mayManageClassSubject).mockReset().mockResolvedValue(false)
  vi.mocked(mayManageCourseworkAssignment).mockReset().mockResolvedValue(false)
  vi.mocked(mayViewSchoolEvent).mockReset().mockResolvedValue(false)
  vi.mocked(visibleCourseworkAssignmentForStudent)
    .mockReset()
    .mockResolvedValue(null)
  vi.mocked(eligibleParentChildren).mockReset().mockResolvedValue([])
  vi.mocked(prismaDocumentDownloadService)
    .mockReset()
    .mockReturnValue({
      find: vi.fn().mockResolvedValue({ id: materialId }),
    })
})

describe('file asset authorization', () => {
  it('blocks quarantined event files and requires the current event audience', async () => {
    const { database } = fixture('eventAttachment')
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'read'),
    ).rejects.toBeInstanceOf(FileAssetAccessError)
    vi.mocked(mayViewSchoolEvent).mockResolvedValue(true)
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'read'),
    ).resolves.toMatchObject({ id: assetId })
    vi.mocked(database.fileAsset.findUnique).mockResolvedValue({
      status: 'quarantined',
    } as never)
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'read'),
    ).rejects.toBeInstanceOf(FileAssetAccessError)
  })
  it('keeps submission files from teachers until both submission and clean scan', async () => {
    const { database } = fixture('courseworkSubmission')
    vi.mocked(mayManageCourseworkAssignment).mockResolvedValue(true)
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'read'),
    ).rejects.toBeInstanceOf(FileAssetAccessError)
    vi.mocked(database.submissionAttachment.findUnique).mockResolvedValue({
      schoolId,
      removedAt: null,
      revision: {
        submittedAt: new Date(),
        submission: {
          schoolId,
          studentId: materialId,
          assignmentId: materialId,
          assignment: { id: materialId },
        },
      },
    } as never)
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'read'),
    ).resolves.toMatchObject({ id: assetId })
    vi.mocked(database.fileScan.findFirst).mockResolvedValue({
      status: 'pending',
      result: null,
    } as never)
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'read'),
    ).rejects.toBeInstanceOf(FileAssetAccessError)
  })
  it('requires a clean scan and current assignment audience for coursework downloads', async () => {
    const { database } = fixture('courseworkAssignment')
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'read'),
    ).rejects.toBeInstanceOf(FileAssetAccessError)
    vi.mocked(visibleCourseworkAssignmentForStudent).mockResolvedValue({
      id: materialId,
    } as never)
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'read'),
    ).resolves.toMatchObject({ id: assetId })
    vi.mocked(database.fileScan.findFirst).mockResolvedValue({
      status: 'quarantined',
      result: 'infected',
    } as never)
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'read'),
    ).rejects.toBeInstanceOf(FileAssetAccessError)
  })
  it('requires current teaching control to manage a learning file', async () => {
    const { database } = fixture()
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'manage'),
    ).rejects.toBeInstanceOf(FileAssetAccessError)
    vi.mocked(mayManageClassSubject).mockResolvedValue(true)
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'manage'),
    ).resolves.toMatchObject({ id: assetId })
  })

  it('permits only eligible class students or parent-portal guardians to read published material', async () => {
    const { database } = fixture()
    vi.mocked(findStudentAccessForUser).mockResolvedValue({
      studentId: 'student',
    } as never)
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'read'),
    ).rejects.toBeInstanceOf(FileAssetAccessError)
    vi.mocked(database.enrollment.findFirst).mockResolvedValue({
      id: 'enrollment',
    } as never)
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'read'),
    ).resolves.toMatchObject({ id: assetId })
    vi.mocked(findStudentAccessForUser).mockResolvedValue(null)
    vi.mocked(database.enrollment.findFirst).mockResolvedValue(null)
    vi.mocked(eligibleParentChildren).mockResolvedValue([
      {
        schoolId,
        academicYearId: 'year',
        schoolClassId: 'class',
      },
    ] as never)
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'read'),
    ).resolves.toMatchObject({ id: assetId })
  })

  it('uses official document scope and denies public or quarantined access', async () => {
    const { database } = fixture('issuedDocument')
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'read'),
    ).resolves.toMatchObject({ id: assetId })
    await expect(
      requireFileAssetAccess(database, '', assetId, 'read'),
    ).rejects.toBeInstanceOf(FileAssetAccessError)
    vi.mocked(database.fileAsset.findUnique).mockResolvedValue({
      status: 'quarantined',
    } as never)
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'read'),
    ).rejects.toBeInstanceOf(FileAssetAccessError)
  })

  it('limits branding management to current school or organization administrators', async () => {
    const { database } = fixture('schoolBranding')
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'manage'),
    ).rejects.toBeInstanceOf(FileAssetAccessError)
    vi.mocked(findSchoolMembership).mockResolvedValue({
      role: 'administrator',
    } as never)
    await expect(
      requireFileAssetAccess(database, actorId, assetId, 'manage'),
    ).resolves.toMatchObject({ id: assetId })
  })
})
