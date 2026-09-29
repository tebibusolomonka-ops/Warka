import { describe, expect, it } from 'vitest'
import { environmentProfile } from './environmentProfile.js'
import { configuredFileStorage } from './objectFileStorage.js'

describe('environment profiles', () => {
  it('uses controlled defaults for development and test', () => {
    expect(environmentProfile({}).defaultFileStorage).toBe('local')
    expect(environmentProfile({ NODE_ENV: 'test' }).deterministicAdapters).toBe(
      true,
    )
  })

  it('requires secure cookies and real providers in production', () => {
    expect(environmentProfile({ NODE_ENV: 'production' })).toMatchObject({
      secureCookies: true,
      defaultFileStorage: 's3',
      deterministicAdapters: false,
      externalProvidersRequired: true,
    })
    expect(() =>
      configuredFileStorage({
        NODE_ENV: 'production',
        FILE_STORAGE_BACKEND: 'local',
        FILE_STORAGE_DIR: 'test-files',
      }),
    ).toThrow('Invalid file storage backend')
  })

  it('rejects unknown environment names', () => {
    expect(() => environmentProfile({ NODE_ENV: 'staging' })).toThrow(
      'Invalid NODE_ENV',
    )
  })
})
