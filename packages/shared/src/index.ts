import { z } from 'zod'

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
})

export type HealthResponse = z.infer<typeof HealthResponseSchema>

export const NameSchema = z.string().trim().min(1).max(200)

export const CreateOrganizationSchema = z.object({
  name: NameSchema,
})

export const CreateSchoolSchema = z.object({
  name: NameSchema,
})

export const OrganizationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const SchoolSchema = OrganizationSchema.extend({
  organizationId: z.uuid(),
})

export const SchoolsResponseSchema = z.array(SchoolSchema)

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

export type Organization = z.infer<typeof OrganizationSchema>
export type School = z.infer<typeof SchoolSchema>

export const LoginCredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(1024),
})

export type LoginCredentials = z.infer<typeof LoginCredentialsSchema>

export const UserIdentitySchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string(),
})

export type UserIdentity = z.infer<typeof UserIdentitySchema>
