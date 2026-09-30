export const REQUEST_LIMITS = {
  jsonBytes: 1 * 1024 * 1024,
  importBodyBytes: 1_100_000,
  importCsvBytes: 1_000_000,
  multipartBodyBytes: 28 * 1024 * 1024,
  schoolBrandingBodyBytes: 3 * 1024 * 1024,
  archiveExpandedBytes: 100 * 1024 * 1024,
} as const

export function withinExpandedArchiveLimit(
  entries: readonly { uncompressedSize: number }[],
) {
  let total = 0
  for (const entry of entries) {
    if (
      !Number.isSafeInteger(entry.uncompressedSize) ||
      entry.uncompressedSize < 0
    )
      return false
    total += entry.uncompressedSize
    if (total > REQUEST_LIMITS.archiveExpandedBytes) return false
  }
  return true
}
