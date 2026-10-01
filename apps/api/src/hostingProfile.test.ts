import { describe, expect, it } from 'vitest'
import { hostingProfile, validateHostingProfile } from './hostingProfile.js'

describe('hosting profiles', () => {
  it('defaults to a single host and accepts secret files', () => {
    expect(
      validateHostingProfile({ DATABASE_URL_FILE: '/run/secrets/db' }),
    ).toEqual({ profile: 'singleHost', missing: [] })
  })

  it('requires external services for managedServices', () => {
    expect(
      validateHostingProfile({
        WARKA_HOSTING_PROFILE: 'managedServices',
        DATABASE_URL: 'db',
      }).missing,
    ).toEqual([
      'OBJECT_STORAGE_SECRET_KEY',
      'OBJECT_STORAGE_ENDPOINT',
      'SMTP_HOST',
      'SMTP_PASSWORD',
      'CLAMAV_HOST',
    ])
  })

  it('rejects unknown profiles', () => {
    expect(() => hostingProfile({ WARKA_HOSTING_PROFILE: 'vendor' })).toThrow()
  })
})
