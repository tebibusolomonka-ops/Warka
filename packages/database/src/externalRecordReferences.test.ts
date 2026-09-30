import { describe, expect, it, vi } from 'vitest'
import { createExternalRecordReference } from './externalRecordReferences.js'

describe('external record references', () => {
  it('scopes an external identifier by source and entity type', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'reference' })
    const database = { externalRecordReference: { create } } as never
    await createExternalRecordReference(
      database,
      '123e4567-e89b-42d3-a456-426614174001',
      {
        sourceSystem: ' ministry ',
        externalId: ' S-12 ',
        entityType: 'student',
        entityId: '123e4567-e89b-42d3-a456-426614174002',
      },
    )
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceSystem: 'ministry',
        externalId: 'S-12',
        entityType: 'student',
      }),
    })
  })

  it('rejects unsupported entity types and empty identifiers', async () => {
    await expect(
      createExternalRecordReference(
        {} as never,
        '123e4567-e89b-42d3-a456-426614174001',
        {
          sourceSystem: '',
          externalId: '',
          entityType: 'guardian',
          entityId: 'bad',
        },
      ),
    ).rejects.toThrow()
  })
})
