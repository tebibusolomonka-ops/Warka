export function smokeConfiguration(env = process.env) {
  if (!env.WARKA_SMOKE_TARGET) throw new Error('WARKA_SMOKE_TARGET is required')
  const target = new URL(env.WARKA_SMOKE_TARGET)
  const local = ['localhost', '127.0.0.1', '::1'].includes(target.hostname)
  if (!local) {
    if (env.WARKA_SMOKE_ALLOW_PRODUCTION !== 'true')
      throw new Error(
        'Non-local smoke targets require WARKA_SMOKE_ALLOW_PRODUCTION=true',
      )
    if (env.WARKA_SMOKE_EXPECTED_HOST !== target.hostname)
      throw new Error('WARKA_SMOKE_EXPECTED_HOST must match the target host')
  }
  return target
}

export async function runSmoke(target, request = fetch) {
  const checks = [
    '/',
    '/api/health',
    '/api/ready',
    '/api/build',
    '/sign-in',
    '/verify/INVALID',
  ]
  for (const path of checks) {
    const response = await request(new URL(path, target), {
      redirect: 'manual',
    })
    if (
      response.status >= 500 ||
      (path !== '/verify/INVALID' && response.status >= 400)
    )
      throw new Error(`Smoke check failed for ${path}: ${response.status}`)
  }
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  runSmoke(smokeConfiguration()).catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Deployment smoke failed'}\n`,
    )
    process.exitCode = 1
  })
}
