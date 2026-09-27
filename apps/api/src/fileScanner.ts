export type ScanOutcome =
  | { status: 'clean' }
  | { status: 'infected' }
  | {
      status: 'failed'
      failureCode: 'SCANNER_UNAVAILABLE' | 'SCANNER_TIMEOUT' | 'SCAN_ERROR'
    }

export type ScannerHealth = 'available' | 'degraded' | 'unavailable'

export interface FileScanner {
  readonly name: 'clamav' | 'test'
  scanBuffer(bytes: Uint8Array): Promise<ScanOutcome>
  scanStream(stream: AsyncIterable<Uint8Array>): Promise<ScanOutcome>
  health(): Promise<ScannerHealth>
}

export class FakeFileScanner implements FileScanner {
  readonly name = 'test' as const
  private readonly outcomes: ScanOutcome[]
  constructor(
    outcomes: ScanOutcome[] = [{ status: 'clean' }],
    private readonly state: ScannerHealth = 'available',
  ) {
    this.outcomes = [...outcomes]
  }
  async scanBuffer(bytes: Uint8Array): Promise<ScanOutcome> {
    if (this.state === 'unavailable')
      return { status: 'failed', failureCode: 'SCANNER_UNAVAILABLE' }
    if (bytes.byteLength === 0)
      return { status: 'failed', failureCode: 'SCAN_ERROR' }
    return this.outcomes.shift() ?? { status: 'clean' }
  }
  async scanStream(stream: AsyncIterable<Uint8Array>): Promise<ScanOutcome> {
    let size = 0
    for await (const chunk of stream) size += chunk.byteLength
    return this.scanBuffer(size ? new Uint8Array([1]) : new Uint8Array())
  }
  async health(): Promise<ScannerHealth> {
    return this.state
  }
}
