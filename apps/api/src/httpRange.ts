export type ByteRange = { start: number; end: number }
export function parseByteRange(
  value: string | undefined,
  size: number,
): ByteRange | null {
  if (!value) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(value)
  if (!match || size <= 0) throw new Error('rangeNotSatisfiable')
  let start = match[1] ? Number(match[1]) : NaN
  let end = match[2] ? Number(match[2]) : size - 1
  if (Number.isNaN(start)) {
    const suffix = end
    if (suffix <= 0) throw new Error('rangeNotSatisfiable')
    start = Math.max(0, size - suffix)
    end = size - 1
  }
  if (start < 0 || start >= size || end < start)
    throw new Error('rangeNotSatisfiable')
  return { start, end: Math.min(end, size - 1) }
}
export function rangeHeaders(range: ByteRange, size: number) {
  return {
    statusCode: 206,
    'accept-ranges': 'bytes',
    'content-range': `bytes ${range.start}-${range.end}/${size}`,
    'content-length': String(range.end - range.start + 1),
  }
}
