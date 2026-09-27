import { describe, expect, it } from 'vitest'
import { configuredFileScanner } from './fileScannerConfig.js'

describe('controlled browser scanner', () => {
  const env = {
    NODE_ENV: 'test',
    WARKA_FILE_SCAN_CONTROLLED_TEST: 'enabled',
    FILE_SCANNER_BACKEND: 'test',
    FILE_SCANNER_TEST_OUTCOME: 'fixture',
  }
  it('recognizes only the synthetic marker and drains stream chunks', async () => {
    const scanner = configuredFileScanner(env)
    expect(await scanner.scanBuffer(Buffer.from('safe lesson'))).toEqual({
      status: 'clean',
    })
    expect(
      await scanner.scanStream(
        (async function* () {
          yield Buffer.from('WARKA_CONTROLLED_')
          yield Buffer.from('INFECTED_FIXTURE')
        })(),
      ),
    ).toEqual({ status: 'infected' })
  })
})
