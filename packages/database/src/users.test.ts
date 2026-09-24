import { describe, expect, it } from 'vitest'
import { normalizeEmail } from './users.js'

describe('normalizeEmail', () => {
  it('normalizes ordinary casing and surrounding space', () => {
    expect(normalizeEmail('  Person@Example.COM  ')).toBe('person@example.com')
  })

  it('rejects invalid email addresses', () => {
    expect(() => normalizeEmail('not an email')).toThrow()
  })
})
