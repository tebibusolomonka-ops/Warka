import { z } from 'zod'

const plainOperationalText = z
  .string()
  .trim()
  .min(3)
  .max(500)
  .refine(
    (value) =>
      !/[<>]/.test(value) &&
      !/[\r\n]/.test(value) &&
      !/[\w.+-]+@[\w.-]+/.test(value),
    'Use a short operational summary without markup or personal identifiers',
  )

export const OperationalIncidentInputSchema = z.strictObject({
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: plainOperationalText.max(120),
  summary: plainOperationalText,
})
