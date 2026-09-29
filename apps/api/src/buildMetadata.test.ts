import { describe, expect, it } from 'vitest'
import { buildMetadata } from './buildMetadata.js'

describe('build metadata', () => {
  it('accepts validated release fields and omits unsafe input', () => {
    expect(
      buildMetadata({
        NODE_ENV: 'production',
        WARKA_BUILD_COMMIT_SHA: 'a'.repeat(40),
        WARKA_BUILD_TIMESTAMP: '2026-09-29T00:00:00Z',
        DATABASE_URL: 'postgresql://private',
      }),
    ).toEqual({
      version: '0.1.0',
      commitSha: 'a'.repeat(40),
      builtAt: '2026-09-29T00:00:00.000Z',
      environment: 'production',
    })
    expect(
      buildMetadata({
        WARKA_BUILD_COMMIT_SHA: 'https://private.example/git',
        WARKA_BUILD_TIMESTAMP: 'private',
      }),
    ).toMatchObject({ commitSha: null, builtAt: null })
  })
})
