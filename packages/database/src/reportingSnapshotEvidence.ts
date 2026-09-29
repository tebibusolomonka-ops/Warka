import { createHash } from 'node:crypto'
import { ReportingSnapshotSchema } from './reportingValidation.js'

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`
  }
  const encoded = JSON.stringify(value)
  if (encoded === undefined)
    throw new Error('Unsupported reporting snapshot value')
  return encoded
}

export function createReportingSnapshotEvidence(input: unknown) {
  const snapshot = ReportingSnapshotSchema.parse(input)
  const serialized = canonicalJson(snapshot)
  return {
    snapshot: JSON.parse(serialized) as typeof snapshot,
    checksum: createHash('sha256').update(serialized).digest('hex'),
  }
}
