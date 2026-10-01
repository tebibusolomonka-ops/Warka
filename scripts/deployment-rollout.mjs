import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { validateDeploymentManifest } from './deployment-manifest.mjs'

export function rolloutPlan(manifest) {
  validateDeploymentManifest(manifest)
  return [
    ['pnpm', ['deployment:manifest:check']],
    ['docker', ['compose', '-f', 'compose.production.yml', 'build']],
    [
      'docker',
      ['compose', '-f', 'compose.production.yml', 'run', '--rm', 'migrate'],
    ],
    [
      'docker',
      ['compose', '-f', 'compose.production.yml', 'up', '-d', '--wait'],
    ],
    ['pnpm', ['deployment:smoke']],
  ]
}

export function executeRollout(manifest, options = {}, run = spawnSync) {
  const plan = rolloutPlan(manifest)
  if (options.dryRun) return plan
  if (!options.environment || options.acknowledgement !== options.environment)
    throw new Error('Explicit environment acknowledgement is required')
  for (const [command, args] of plan) {
    const executable =
      process.platform === 'win32' && command === 'pnpm' ? 'pnpm.cmd' : command
    const result = run(executable, args, { stdio: 'inherit' })
    if (result.error || result.status !== 0)
      throw new Error(`Rollout stopped at ${command} ${args.join(' ')}`)
  }
  return plan
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  const manifest = JSON.parse(
    await readFile(
      new URL('../release/deployment-manifest.json', import.meta.url),
      'utf8',
    ),
  )
  const dryRun = process.argv.includes('--dry-run')
  const plan = executeRollout(manifest, {
    dryRun,
    environment: process.env.WARKA_DEPLOYMENT_ENVIRONMENT,
    acknowledgement: process.env.WARKA_DEPLOYMENT_ACK,
  })
  if (dryRun)
    process.stdout.write(
      `${plan.map(([c, a]) => `${c} ${a.join(' ')}`).join('\n')}\n`,
    )
}
