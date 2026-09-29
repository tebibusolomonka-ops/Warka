import { describe, expect, it } from 'vitest'
import {
  beforeStableCursor,
  decodeStableCursor,
  encodeStableCursor,
} from './stablePagination.js'

describe('stable pagination cursors', () => {
  it('round trips a deterministic timestamp and identifier boundary', () => {
    const boundary = {
      at: new Date('2026-09-30T00:00:00.000Z'),
      id: '123e4567-e89b-42d3-a456-426614174001',
    }
    expect(decodeStableCursor(encodeStableCursor(boundary))).toEqual(boundary)
    expect(beforeStableCursor(boundary, 'createdAt')).toEqual({
      OR: [
        { createdAt: { lt: boundary.at } },
        { createdAt: boundary.at, id: { lt: boundary.id } },
      ],
    })
  })

  it('rejects malformed or incomplete cursors', () => {
    expect(() => decodeStableCursor('not-a-cursor')).toThrow(
      'Invalid pagination cursor',
    )
  })
})
