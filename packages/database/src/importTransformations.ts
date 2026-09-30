import { z } from 'zod'

const RuleSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('trim'), field: z.string().min(1).max(80) }),
  z.strictObject({
    kind: z.literal('date'),
    field: z.string().min(1).max(80),
    order: z.enum(['ymd', 'dmy']),
  }),
  z.strictObject({
    kind: z.literal('yesNo'),
    field: z.string().min(1).max(80),
    yes: z.array(z.string().max(40)).max(10),
    no: z.array(z.string().max(40)).max(10),
  }),
  z.strictObject({
    kind: z.literal('enumMap'),
    field: z.string().min(1).max(80),
    values: z
      .record(z.string().max(80), z.string().max(80))
      .refine((value) => Object.keys(value).length <= 50),
  }),
  z.strictObject({
    kind: z.literal('combine'),
    fields: z.array(z.string().min(1).max(80)).min(2).max(4),
    target: z.string().min(1).max(80),
    separator: z.enum([' ', '-', '/']),
  }),
  z.strictObject({
    kind: z.literal('split'),
    field: z.string().min(1).max(80),
    targets: z.tuple([z.string().min(1).max(80), z.string().min(1).max(80)]),
    separator: z.enum([' ', '-', '/']),
  }),
])
export const ImportTransformationConfigSchema = z.array(RuleSchema).max(30)

export function transformImportRow(
  row: Record<string, string>,
  input: unknown,
) {
  const rules = ImportTransformationConfigSchema.parse(input)
  const output = { ...row }
  for (const rule of rules) {
    if (rule.kind === 'trim')
      output[rule.field] = (output[rule.field] ?? '').trim()
    if (rule.kind === 'date') {
      const parts = (output[rule.field] ?? '').trim().split(/[-/]/)
      if (parts.length !== 3 || parts.some((part) => !/^\d{1,4}$/.test(part)))
        throw new Error(`Invalid date in ${rule.field}`)
      const [a, b, c] = parts.map(Number)
      const [year, month, day] = rule.order === 'ymd' ? [a, b, c] : [c, b, a]
      const date = new Date(Date.UTC(year!, month! - 1, day!))
      if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month! - 1 ||
        date.getUTCDate() !== day
      )
        throw new Error(`Invalid date in ${rule.field}`)
      output[rule.field] =
        `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
    if (rule.kind === 'yesNo') {
      const value = (output[rule.field] ?? '').trim().toLowerCase()
      if (rule.yes.map((item) => item.toLowerCase()).includes(value))
        output[rule.field] = 'yes'
      else if (rule.no.map((item) => item.toLowerCase()).includes(value))
        output[rule.field] = 'no'
      else throw new Error(`Unsupported yes/no value in ${rule.field}`)
    }
    if (rule.kind === 'enumMap') {
      const value = output[rule.field] ?? ''
      if (!(value in rule.values))
        throw new Error(`Unmapped enum value in ${rule.field}`)
      output[rule.field] = rule.values[value]!
    }
    if (rule.kind === 'combine')
      output[rule.target] = rule.fields
        .map((field) => output[field] ?? '')
        .join(rule.separator)
    if (rule.kind === 'split') {
      const index = (output[rule.field] ?? '').indexOf(rule.separator)
      if (index < 0) throw new Error(`Cannot split ${rule.field}`)
      output[rule.targets[0]] = output[rule.field]!.slice(0, index)
      output[rule.targets[1]] = output[rule.field]!.slice(
        index + rule.separator.length,
      )
    }
  }
  return output
}

export function previewImportTransformations(
  row: Record<string, string>,
  rules: unknown,
) {
  return { before: { ...row }, after: transformImportRow(row, rules) }
}
