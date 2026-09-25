import { describe, expect, it, vi } from 'vitest'
import {
  BureauAccessDeniedError,
  grantBureauAccess,
  requireBureauPermission,
  resolveBureauScope,
  revokeBureauAccess,
} from './bureauAccess.js'

describe('bureau access', () => {
  it('keeps regional access separate and enforces manager permission', async () => {
    const store = {
      bureauAccess: {
        create: vi.fn().mockResolvedValue({ role: 'viewer' }),
        update: vi.fn().mockResolvedValue({ revokedAt: new Date() }),
        findMany: vi.fn().mockResolvedValue([{ organization: { id: 'one' } }]),
        findUnique: vi
          .fn()
          .mockResolvedValue({ role: 'viewer', revokedAt: null }),
      },
    }
    await grantBureauAccess(store as never, {
      userId: 'user',
      organizationId: 'one',
      role: 'viewer',
    })
    expect(await resolveBureauScope(store as never, 'user')).toHaveLength(1)
    await expect(
      requireBureauPermission(store as never, 'user', 'one', 'manage'),
    ).rejects.toBeInstanceOf(BureauAccessDeniedError)
    await revokeBureauAccess(store as never, 'user', 'one')
    expect(store.bureauAccess.update).toHaveBeenCalled()
  })
})
