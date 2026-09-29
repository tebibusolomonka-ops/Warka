import { describe, expect, it } from 'vitest'
import {
  assertProductionConfiguration,
  validateProductionConfiguration,
} from './productionConfiguration.js'

const valid = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:private@localhost:5432/warka',
  PUBLIC_BASE_URL: 'https://warka.example.test',
  FILE_STORAGE_BACKEND: 's3',
  FILE_STORAGE_BUCKET: 'private-warka',
  FILE_STORAGE_REGION: 'us-east-1',
}

describe('production configuration', () => {
  it('accepts valid core configuration with disabled optional features', () => {
    expect(validateProductionConfiguration(valid)).toEqual([])
  })

  it('reports missing core configuration by name', () => {
    expect(validateProductionConfiguration({ NODE_ENV: 'production' })).toEqual(
      expect.arrayContaining([
        { category: 'requiredCore', names: ['DATABASE_URL'] },
        { category: 'requiredCore', names: ['PUBLIC_BASE_URL'] },
      ]),
    )
  })

  it('requires enabled provider configuration without returning secrets', () => {
    const env = {
      ...valid,
      WARKA_EMAIL_OUTBOX_ENABLED: 'true',
      SMTP_PASSWORD: 'private-smtp-password',
    }
    expect(
      validateProductionConfiguration(env).map((item) => item.category),
    ).toContain('requiredWhenEnabled')
    expect(() => assertProductionConfiguration(env)).toThrow(
      'Invalid production configuration',
    )
    try {
      assertProductionConfiguration(env)
    } catch (error) {
      expect(String(error)).not.toContain('private-smtp-password')
      expect(String(error)).not.toContain('private@localhost')
    }
  })

  it('keeps development and test environments practical', () => {
    expect(
      validateProductionConfiguration({ NODE_ENV: 'development' }),
    ).toEqual([])
    expect(validateProductionConfiguration({ NODE_ENV: 'test' })).toEqual([])
  })
})
