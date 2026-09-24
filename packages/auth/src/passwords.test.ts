import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './passwords.js'

describe('password hashing', () => {
  it('creates salted Argon2id hashes and verifies the correct password', async () => {
    const password = 'a long test password'
    const first = await hashPassword(password)
    const second = await hashPassword(password)

    expect(first).toMatch(/^\$argon2id\$/)
    expect(first).not.toBe(second)
    expect(await verifyPassword(password, first)).toBe(true)
    expect(await verifyPassword('wrong password', first)).toBe(false)
    expect(await verifyPassword(password, null)).toBe(false)
  })

  it('rejects passwords shorter than the minimum length', async () => {
    await expect(hashPassword('short')).rejects.toThrow()
  })
})
