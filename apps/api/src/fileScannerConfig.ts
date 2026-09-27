import { ClamAvScanner, clamAvConfiguration } from './clamAvScanner.js'
import {
  FakeFileScanner,
  type FileScanner,
  type ScanOutcome,
} from './fileScanner.js'

export function configuredFileScanner(
  env: NodeJS.ProcessEnv = process.env,
): FileScanner {
  if (
    env.FILE_SCANNER_BACKEND === 'test' &&
    env.NODE_ENV === 'test' &&
    env.WARKA_FILE_SCAN_CONTROLLED_TEST === 'enabled'
  ) {
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
