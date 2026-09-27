import { createServer } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { ClamAvScanner, clamAvConfiguration } from './clamAvScanner.js'

const servers: ReturnType<typeof createServer>[] = []
afterEach(async () =>
  Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  ),
)

async function scanner(response: string | null) {
  const server = createServer((socket) => {
    let data = Buffer.alloc(0)
    socket.on('data', (chunk) => {
      data = Buffer.concat([data, chunk])
      if (data.subarray(0, 6).toString() === 'zPING\0') {
        socket.end('PONG\0')
        return
      }
      const prefix = Buffer.from('zINSTREAM\0')
      if (
        data.length < prefix.length ||
        !data.subarray(0, prefix.length).equals(prefix)
      )
        return
      let offset = prefix.length
      while (offset + 4 <= data.length) {
        const length = data.readUInt32BE(offset)
        if (length === 0) {
          if (response) socket.end(response)
          return
        }
        if (offset + 4 + length > data.length) return
        offset += 4 + length
      }
    })
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No test port')
  return new ClamAvScanner({
    host: '127.0.0.1',
    port: address.port,
    timeoutMs: 150,
  })
}

describe('ClamAV protocol adapter', () => {
  it('validates configuration without exposing arbitrary socket paths', () => {
    expect(() =>
      clamAvConfiguration({ CLAMAV_HOST: '../../secret', CLAMAV_PORT: '3310' }),
    ).toThrow()
    expect(() =>
      clamAvConfiguration({ CLAMAV_HOST: 'localhost', CLAMAV_PORT: '0' }),
    ).toThrow()
  })
  it('handles clean, infected, and protocol failure without returning signatures', async () => {
    expect(
      await (await scanner('stream: OK\0')).scanBuffer(new Uint8Array([1, 2])),
    ).toEqual({ status: 'clean' })
    expect(
      await (
        await scanner('stream: TEST-SIGNATURE FOUND\0')
      ).scanBuffer(new Uint8Array([1])),
    ).toEqual({ status: 'infected' })
    expect(
      await (await scanner('stream: ERROR\0')).scanBuffer(new Uint8Array([1])),
    ).toEqual({ status: 'failed', failureCode: 'SCAN_ERROR' })
  })
  it('does not treat unavailable or timeout as clean', async () => {
    expect(await (await scanner(null)).scanBuffer(new Uint8Array([1]))).toEqual(
      { status: 'failed', failureCode: 'SCANNER_TIMEOUT' },
    )
    const unused = createServer()
    await new Promise<void>((resolve) => unused.listen(0, '127.0.0.1', resolve))
    const address = unused.address()
    if (!address || typeof address === 'string') throw new Error('No test port')
    const port = address.port
    await new Promise<void>((resolve) => unused.close(() => resolve()))
    expect(
      await new ClamAvScanner({
        host: '127.0.0.1',
        port,
        timeoutMs: 150,
      }).scanBuffer(new Uint8Array([1])),
    ).toEqual({ status: 'failed', failureCode: 'SCANNER_UNAVAILABLE' })
  })
  it('reports daemon health using PING only', async () => {
    expect(await (await scanner('stream: OK\0')).health()).toBe('available')
  })
})
