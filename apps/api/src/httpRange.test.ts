import { describe, expect, it } from 'vitest'
import { parseByteRange, rangeHeaders } from './httpRange.js'
describe('HTTP ranges after authorization', () => {
  it('parses authorized ranges and full requests', () => {
    expect(parseByteRange(undefined, 100)).toBeNull()
    const range = parseByteRange('bytes=10-19', 100)!
    expect(rangeHeaders(range, 100)).toMatchObject({
      statusCode: 206,
      'content-range': 'bytes 10-19/100',
    })
  })
  it('rejects invalid and unsatisfiable ranges', () => {
    expect(() => parseByteRange('bytes=100-120', 100)).toThrow(
      'rangeNotSatisfiable',
    )
    expect(() => parseByteRange('items=1-2', 100)).toThrow()
  })
})
