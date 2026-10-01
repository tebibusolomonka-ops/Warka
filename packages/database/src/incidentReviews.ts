import { z } from 'zod'

const operationalText = z
  .string()
  .trim()
  .min(3)
  .max(2000)
  .refine((value) => !/[<>]/.test(value))

export const IncidentReviewInputSchema = z.strictObject({
  impactSummary: operationalText,
  rootCauseSummary: z.union([
    operationalText,
    z.literal('unknown'),
    z.literal('under investigation'),
  ]),
  detectionNotes: operationalText,
  responseNotes: operationalText,
  followUpActions: z
    .array(
      z.strictObject({
        action: operationalText.max(300),
        owner: z.string().trim().min(2).max(80),
      }),
    )
    .max(25),
})

export function prepareIncidentReview(incidentStatus: string, input: unknown) {
  return { incidentStatus, review: IncidentReviewInputSchema.parse(input) }
}
