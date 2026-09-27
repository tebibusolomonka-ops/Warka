import { ClamAvScanner, clamAvConfiguration } from './clamAvScanner.js'
import {
  FakeFileScanner,
  type FileScanner,
  type ScanOutcome,
} from './fileScanner.js'
import { Buffer } from 'node:buffer'

export function configuredFileScanner(
  env: NodeJS.ProcessEnv = process.env,
): FileScanner {
  if (
    env.FILE_SCANNER_BACKEND === 'test' &&
    env.NODE_ENV === 'test' &&
    env.WARKA_FILE_SCAN_CONTROLLED_TEST === 'enabled'
  ) {
    if (env.FILE_SCANNER_TEST_OUTCOME === 'fixture')
      return {
        name: 'test',
        health: async () => 'available' as const,
        scanBuffer: async (bytes: Uint8Array) =>
          Buffer.from(bytes).includes('WARKA_CONTROLLED_INFECTED_FIXTURE')
            ? { status: 'infected' as const }
            : { status: 'clean' as const },
        scanStream: async (stream: AsyncIterable<Uint8Array>) => {
          let marker = ''
          let infected = false
          for await (const chunk of stream) {
            marker = (marker + Buffer.from(chunk).toString('utf8')).slice(-128)
            if (marker.includes('WARKA_CONTROLLED_INFECTED_FIXTURE'))
              infected = true
          }
          return infected
            ? { status: 'infected' as const }
            : { status: 'clean' as const }
        },
      }
    const outcome: ScanOutcome =
      env.FILE_SCANNER_TEST_OUTCOME === 'infected'
        ? { status: 'infected' }
        : env.FILE_SCANNER_TEST_OUTCOME === 'failed'
          ? { status: 'failed', failureCode: 'SCAN_ERROR' }
          : { status: 'clean' }
    return new FakeFileScanner([outcome])
  }
  if (!env.FILE_SCANNER_BACKEND || env.FILE_SCANNER_BACKEND === 'clamav')
    return new ClamAvScanner(clamAvConfiguration(env))
  throw new Error('Invalid file scanner backend')
}

export function configuredScannerName(
  env: NodeJS.ProcessEnv = process.env,
): 'clamav' | 'test' {
  return env.NODE_ENV === 'test' &&
    env.WARKA_FILE_SCAN_CONTROLLED_TEST === 'enabled' &&
    env.FILE_SCANNER_BACKEND === 'test'
    ? 'test'
    : 'clamav'
}
