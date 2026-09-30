import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { trustedProxyConfiguration } from './proxyTrust.js'

const route = (trustProxy: false | string[]) => {
  const app = Fastify({ trustProxy })
  app.get('/', async (request) => ({
    ip: request.ip,
    protocol: request.protocol,
  }))
  return app
}

describe('proxy trust boundaries', () => {
  it('ignores forwarding headers from direct or untrusted clients', async () => {
    const direct = route(false)
    const response = await direct.inject({
      url: '/',
      headers: {
        'x-forwarded-for': '203.0.113.7',
        'x-forwarded-proto': 'https',
      },
    })
    expect(response.json().ip).not.toBe('203.0.113.7')
    expect(response.json().protocol).toBe('http')
    await direct.close()
  })

  it('uses forwarding data only for an explicitly trusted proxy', async () => {
    const trusted = route(['127.0.0.1'])
    const response = await trusted.inject({
      url: '/',
      remoteAddress: '127.0.0.1',
      headers: {
        'x-forwarded-for': '203.0.113.7',
        'x-forwarded-proto': 'https',
      },
    })
    expect(response.json()).toEqual({ ip: '203.0.113.7', protocol: 'https' })
    await trusted.close()
  })

  it('rejects broad or malformed proxy configuration', () => {
    expect(trustedProxyConfiguration({})).toBe(false)
    expect(() =>
      trustedProxyConfiguration({ WARKA_TRUSTED_PROXIES: '*' }),
    ).toThrow()
    expect(
      trustedProxyConfiguration({ WARKA_TRUSTED_PROXIES: '10.0.0.0/8,::1' }),
    ).toEqual(['10.0.0.0/8', '::1'])
  })
})
