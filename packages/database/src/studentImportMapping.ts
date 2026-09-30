import { z } from 'zod'

export const STUDENT_IMPORT_FIELDS = [
  'givenName',
  'middleName',
  'familyName',
  'dateOfBirth',
  'externalStudentId',
  'grade',
  'schoolClass',
  'guardianName',
  'guardianPhone',
  'guardianEmail',
  'guardianRelationship',
] as const
export type StudentImportField = (typeof STUDENT_IMPORT_FIELDS)[number]
const REQUIRED_FIELDS = ['givenName', 'grade'] satisfies StudentImportField[]
export const StudentColumnMappingSchema = z
  .array(
    z.strictObject({
      sourceColumn: z.string().trim().min(1).max(120),
      targetField: z.enum(STUDENT_IMPORT_FIELDS),
    }),
  )
  .min(1)
  .max(STUDENT_IMPORT_FIELDS.length)
  .superRefine((entries, context) => {
    for (const required of REQUIRED_FIELDS)
      if (!entries.some((entry) => entry.targetField === required))
        context.addIssue({
          code: 'custom',
          message: `Required mapping missing: ${required}`,
        })
    const targets = entries.map((entry) => entry.targetField)
    if (new Set(targets).size !== targets.length)
      context.addIssue({
        code: 'custom',
        message: 'Target fields may be mapped only once',
      })
  })

export function previewStudentColumnMapping(
  headers: string[],
  sourceRows: string[][],
  input: unknown,
) {
  const mapping = StudentColumnMappingSchema.parse(input)
  const known = new Set(headers)
  if (mapping.some((entry) => !known.has(entry.sourceColumn)))
    throw new Error('Mapping references an unknown source column')
  return mapping.map((entry) => {
    const index = headers.indexOf(entry.sourceColumn)
    return {
      sourceColumn: entry.sourceColumn,
      targetField: entry.targetField,
      state: 'mapped' as const,
      sample: sourceRows
        .slice(0, 3)
        .map((row) => String(row[index] ?? '').slice(0, 120)),
    }
  })
}
