import { afterEach, describe, expect, it, vi } from 'vitest'
import { operationsTestActions } from './operationsTestAdapter.js'

afterEach(() => vi.unstubAllEnvs())

describe('controlled operations browser adapter', () => {
  it('is unavailable unless both test-mode gates are enabled', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('OPERATIONS_TEST_ADAPTER', 'enabled')
    expect(operationsTestActions()).toBeUndefined()
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('OPERATIONS_TEST_ADAPTER', '')
    expect(operationsTestActions()).toBeUndefined()
    vi.stubEnv('OPERATIONS_TEST_ADAPTER', 'enabled')
    expect(operationsTestActions()).toHaveProperty('backup')
  })
})
