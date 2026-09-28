import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mayManageCourseworkAssignment } from './courseworkAudience.js'
import {
  CourseworkRubricInputSchema,
  CourseworkRubricError,
  createCourseworkRubric,
  replaceCourseworkRubric,
} from './courseworkRubrics.js'

vi.mock('./courseworkAudience.js', () => ({
  mayManageCourseworkAssignment: vi.fn(),
}))
const id = '00000000-0000-4000-8000-000000000001'
const input = {
  title: 'Written response',
  criteria: [
    { title: 'Clarity', description: 'Clear explanation', maxPoints: '10.00' },
    { title: 'Evidence', description: 'Uses the source', maxPoints: '20.00' },
  ],
}
function fixture(frozenAt: Date | null = null) {
  const transaction = {
    courseworkRubric: {
      findFirst: vi.fn().mockResolvedValue(frozenAt ? null : { id }),
      update: vi.fn().mockResolvedValue({ id }),
    },
    rubricCriterion: {
      deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  }
  const database = {
    courseworkAssignment: {
      findFirst: vi.fn().mockResolvedValue({ id, status: 'published' }),
    },
    courseworkRubric: { create: vi.fn().mockResolvedValue({ id }) },
    $transaction: vi.fn(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  } as unknown as PrismaClient
  return { database, transaction }
}
beforeEach(() =>
  vi.mocked(mayManageCourseworkAssignment).mockReset().mockResolvedValue(true),
)
describe('coursework rubrics', () => {
  it('bounds criteria and rejects executable or HTML content', () => {
    expect(() =>
      CourseworkRubricInputSchema.parse({
        ...input,
        criteria: [
          { ...input.criteria[0], description: '<script>bad</script>' },
        ],
      }),
    ).toThrow()
    expect(() =>
      CourseworkRubricInputSchema.parse({
        ...input,
        criteria: Array.from({ length: 21 }, () => input.criteria[0]),
      }),
    ).toThrow()
  })
  it('creates ordered criteria only for an authorized assignment', async () => {
    const { database } = fixture()
    await createCourseworkRubric(database, id, id, id, input)
    expect(database.courseworkRubric.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          criteria: {
            create: expect.arrayContaining([
              expect.objectContaining({ sortOrder: 1 }),
            ]),
          },
        }),
      }),
    )
    vi.mocked(mayManageCourseworkAssignment).mockResolvedValue(false)
    await expect(
      createCourseworkRubric(database, id, id, id, input),
    ).rejects.toBeInstanceOf(CourseworkRubricError)
  })
  it('freezes criterion changes after scoring begins', async () => {
    const { database, transaction } = fixture(new Date())
    await expect(
      replaceCourseworkRubric(database, id, id, id, input),
    ).rejects.toBeInstanceOf(CourseworkRubricError)
    expect(transaction.rubricCriterion.deleteMany).not.toHaveBeenCalled()
  })
})
