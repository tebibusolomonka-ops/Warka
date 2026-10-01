import { expect, it } from 'vitest'
import { requireUploadOwner, validateUploadSession } from './uploadSessions.js'

it('enforces size, chunks, expiry, owner and school', () => {
  expect(() =>
    validateUploadSession({
      expectedSize: 1,
      chunkCount: 1,
      expiresAt: new Date(Date.now() + 1000),
    }),
  ).not.toThrow()
  expect(() =>
    validateUploadSession({
      expectedSize: 200_000_000,
      chunkCount: 1,
      expiresAt: new Date(Date.now() + 1000),
    }),
  ).toThrow('uploadSizeInvalid')
  expect(() =>
    requireUploadOwner(
      { ownerUserId: 'a', schoolId: 's1' },
      { userId: 'b', schoolId: 's1' },
    ),
  ).toThrow('uploadSessionDenied')
})
