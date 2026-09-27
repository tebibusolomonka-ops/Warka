import { describe, expect, it } from 'vitest'
import { FakeFileScanner } from './fileScanner.js'

describe('file scanner contract', () => {
  it('returns controlled clean, infected, and failed outcomes', async () => {
    const scanner = new FakeFileScanner([
      { status: 'clean' },
      { status: 'infected' },
      { status: 'failed', failureCode: 'SCANNER_TIMEOUT' },
    ])
    expect(await scanner.scanBuffer(new Uint8Array([1]))).toEqual({
      status: 'clean',
    })
    expect(
      await scanner.scanStream(
        (async function* () {
          yield new Uint8Array([2])
        })(),
      ),
    ).toEqual({ status: 'infected' })
    expect(await scanner.scanBuffer(new Uint8Array([3]))).toEqual({
      status: 'failed',
      failureCode: 'SCANNER_TIMEOUT',
    })
  })

  it('reports health and treats empty input as failure', async () => {
    const scanner = new FakeFileScanner([], 'unavailable')
    expect(await scanner.health()).toBe('unavailable')
    expect(await scanner.scanBuffer(new Uint8Array())).toEqual({
      status: 'failed',
      failureCode: 'SCANNER_UNAVAILABLE',
    })
    expect(await new FakeFileScanner().scanBuffer(new Uint8Array())).toEqual({
      status: 'failed',
      failureCode: 'SCAN_ERROR',
    })
  })
})
