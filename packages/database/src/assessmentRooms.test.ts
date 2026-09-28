import { describe, expect, it } from 'vitest'
import { AssessmentRoomInputSchema } from './assessmentRooms.js'

const input = {
  schoolId: '6f366e77-a14d-469d-9ea5-737091a426cf',
  name: 'Science room',
  code: 'SCI-1',
}

describe('assessment room input', () => {
  it('permits a room without a capacity', () => {
    expect(AssessmentRoomInputSchema.parse(input)).toEqual(input)
  })

  it('rejects invalid capacity and long names or codes', () => {
    expect(() =>
      AssessmentRoomInputSchema.parse({ ...input, capacity: 0 }),
    ).toThrow()
    expect(() =>
      AssessmentRoomInputSchema.parse({ ...input, name: 'a'.repeat(81) }),
    ).toThrow()
    expect(() =>
      AssessmentRoomInputSchema.parse({ ...input, code: 'a'.repeat(25) }),
    ).toThrow()
  })
})
