import { createConnection, type Socket } from 'node:net'
import { once } from 'node:events'
import { z } from 'zod'
import type { FileScanner, ScanOutcome, ScannerHealth } from './fileScanner.js'

const configurationSchema = z.strictObject({
  host: z
    .string()
    .min(1)
    .max(253)
    .regex(/^[A-Za-z0-9.:-]+$/),
  port: z.number().int().min(1).max(65535),
  timeoutMs: z.number().int().min(100).max(30000),
})

export function clamAvConfiguration(env: NodeJS.ProcessEnv = process.env) {
  return configurationSchema.parse({
    host: env.CLAMAV_HOST,
    port: Number(env.CLAMAV_PORT),
    timeoutMs: Number(env.CLAMAV_TIMEOUT_MS ?? 5000),
  })
}

export class ClamAvScanner implements FileScanner {
  readonly name = 'clamav' as const
  private readonly config: z.infer<typeof configurationSchema>
  constructor(config: z.input<typeof configurationSchema>) {
    this.config = configurationSchema.parse(config)
  }

  private async request(write: (socket: Socket) => Promise<void>) {
    const socket = createConnection({
      host: this.config.host,
      port: this.config.port,
    })
    try {
      return await new Promise<string>((resolve, reject) => {
        let output = ''
        socket.setTimeout(this.config.timeoutMs, () =>
          reject(new Error('SCANNER_TIMEOUT')),
        )
        socket.on('error', () => reject(new Error('SCANNER_UNAVAILABLE')))
        socket.on('connect', () => {
          void write(socket).catch(reject)
        })
        socket.on('data', (chunk: Buffer) => {
          output += chunk.toString('utf8')
          if (output.length > 4096) reject(new Error('SCAN_ERROR'))
          else if (output.includes('\0') || output.includes('\n'))
            resolve(output)
        })
        socket.on('end', () =>
          output ? resolve(output) : reject(new Error('SCAN_ERROR')),
        )
      })
    } finally {
      socket.destroy()
    }
  }

  async scanBuffer(bytes: Uint8Array): Promise<ScanOutcome> {
    return this.scanStream(
      (async function* () {
        yield bytes
      })(),
    )
  }

  async scanStream(stream: AsyncIterable<Uint8Array>): Promise<ScanOutcome> {
    try {
      const response = await this.request(async (socket) => {
        socket.write('zINSTREAM\0')
        let total = 0
        for await (const chunk of stream) {
          total += chunk.byteLength
          if (total > 25 * 1024 * 1024) throw new Error('SCAN_ERROR')
          const frame = Buffer.allocUnsafe(4)
          frame.writeUInt32BE(chunk.byteLength)
          if (!socket.write(frame)) await once(socket, 'drain')
          if (!socket.write(chunk)) await once(socket, 'drain')
        }
        socket.write(Buffer.alloc(4))
      })
      if (/^stream: OK(?:\0|\n)/.test(response)) return { status: 'clean' }
      if (/^stream: .{1,256} FOUND(?:\0|\n)/.test(response))
        return { status: 'infected' }
      return { status: 'failed', failureCode: 'SCAN_ERROR' }
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      return {
        status: 'failed',
        failureCode:
          code === 'SCANNER_TIMEOUT'
            ? 'SCANNER_TIMEOUT'
            : code === 'SCANNER_UNAVAILABLE'
              ? 'SCANNER_UNAVAILABLE'
              : 'SCAN_ERROR',
      }
    }
  }

  async health(): Promise<ScannerHealth> {
    try {
      const response = await this.request(async (socket) => {
        socket.write('zPING\0')
      })
      return response.startsWith('PONG') ? 'available' : 'degraded'
    } catch {
      return 'unavailable'
    }
  }
}
