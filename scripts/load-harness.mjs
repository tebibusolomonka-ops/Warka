import autocannon from 'autocannon'
import { pathToFileURL } from 'node:url'

const profiles = {
  smoke: { connections: 1, duration: 1, requests: [{ path: '/health' }] },
}

function integer(value, fallback, minimum, maximum, name) {
  const parsed = Number(value ?? fallback)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new Error(`Invalid ${name}`)
  return parsed
}

export function loadConfiguration(env = process.env) {
  if (!env.WARKA_LOAD_TARGET) throw new Error('WARKA_LOAD_TARGET is required')
  const target = new URL(env.WARKA_LOAD_TARGET)
  if (
    !['http:', 'https:'].includes(target.protocol) ||
    target.username ||
    target.password
  )
    throw new Error('Invalid load target URL')
  const environment = env.WARKA_LOAD_ENV
  if (!['local', 'test', 'staging', 'production'].includes(environment ?? ''))
    throw new Error('WARKA_LOAD_ENV must name an acknowledged environment')
  if (env.WARKA_LOAD_ACK !== environment)
    throw new Error('WARKA_LOAD_ACK must match WARKA_LOAD_ENV')
  const obviousProduction =
    environment === 'production' ||
    /(^|\.)(www|app|prod|production)\./i.test(target.hostname)
  if (obviousProduction && env.WARKA_ALLOW_PRODUCTION_LOAD !== 'true')
    throw new Error('Production load testing requires an explicit override')
  const profileName = env.WARKA_LOAD_PROFILE ?? 'smoke'
  const profile = profiles[profileName]
  if (!profile) throw new Error('Unknown load profile')
  return {
    target: target.origin,
    environment,
    profileName,
    connections: integer(
      env.WARKA_LOAD_CONNECTIONS,
      profile.connections,
      1,
      100,
      'connection count',
    ),
    duration: integer(
      env.WARKA_LOAD_DURATION_SECONDS,
      profile.duration,
      1,
      300,
      'duration',
    ),
    requests: profile.requests,
    token: env.WARKA_LOAD_TOKEN,
  }
}

export async function runLoad(config) {
  const result = await autocannon({
    url: config.target,
    connections: config.connections,
    duration: config.duration,
    requests: config.requests.map((request) => ({
      ...request,
      headers: config.token
        ? { authorization: `Bearer ${config.token}` }
        : undefined,
    })),
  })
  return {
    profile: config.profileName,
    environment: config.environment,
    requests: result.requests.total,
    throughputPerSecond: result.requests.average,
    latency: {
      p50: result.latency.p50,
      p95: result.latency.p95,
      p99: result.latency.p99,
    },
    errors: result.errors,
    timeouts: result.timeouts,
  }
}

async function main() {
  const config = loadConfiguration()
  if (process.argv.includes('--validate')) {
    process.stdout.write(
      `${JSON.stringify({ valid: true, profile: config.profileName })}\n`,
    )
    return
  }
  process.stdout.write(`${JSON.stringify(await runLoad(config), null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  await main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Load test failed'}\n`,
    )
    process.exitCode = 1
  })
