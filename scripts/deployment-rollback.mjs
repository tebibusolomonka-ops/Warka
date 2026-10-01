import { spawnSync } from 'node:child_process'
import { evaluateRollbackReadiness } from './rollback-readiness.mjs'
import { validateDeploymentManifest } from './deployment-manifest.mjs'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

export function executeRollback(
  current,
  target,
  options = {},
  run = spawnSync,
) {
  validateDeploymentManifest(current)
  validateDeploymentManifest(target)
  const eligibility = evaluateRollbackReadiness(current, target)
  if (eligibility.status === 'blocked') throw new Error('Rollback is blocked')
  if (
    eligibility.status === 'requiresReview' &&
    options.reviewAcknowledgement !== target.releaseVersion
  )
    throw new Error('Rollback requires explicit review acknowledgement')
  const plan = [
    [
      'docker',
      ['compose', '-f', 'compose.production.yml', 'pull', 'api', 'web'],
    ],
    [
      'docker',
      [
        'compose',
        '-f',
        'compose.production.yml',
        'up',
        '-d',
        '--wait',
        'api',
        'web',
        'gateway',
      ],
    ],
    ['pnpm', ['deployment:smoke']],
  ]
  if (options.dryRun) return { eligibility, plan }
  for (const [command, args] of plan) {
    const executable =
      process.platform === 'win32' && command === 'pnpm' ? 'pnpm.cmd' : command
    const result = run(executable, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        WARKA_API_IMAGE: target.images.api,
        WARKA_WEB_IMAGE: target.images.web,
      },
    })
    if (result.error || result.status !== 0)
      throw new Error(`Rollback failed at ${command} ${args.join(' ')}`)
  }
  return { eligibility, plan }
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  const targetName = process.env.WARKA_ROLLBACK_TARGET
  if (!targetName || basename(targetName) !== targetName)
    throw new Error('WARKA_ROLLBACK_TARGET must name a known manifest')
  const current = JSON.parse(
    await readFile(
      new URL('../release/deployment-manifest.json', import.meta.url),
      'utf8',
    ),
  )
  const target = JSON.parse(
    await readFile(
      new URL(`../release/manifests/${targetName}`, import.meta.url),
      'utf8',
    ),
  )
  const result = executeRollback(current, target, {
    dryRun: process.argv.includes('--dry-run'),
    reviewAcknowledgement: process.env.WARKA_ROLLBACK_REVIEW_ACK,
  })
  if (process.argv.includes('--dry-run'))
    process.stdout.write(`${JSON.stringify(result)}\n`)
}
