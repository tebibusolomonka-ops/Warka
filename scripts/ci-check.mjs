import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { parseDocument } from 'yaml'

export const REQUIRED_VALIDATION_COMMANDS = [
  'pnpm install --frozen-lockfile',
  'pnpm db:deploy',
  'pnpm lint',
  'pnpm format:check',
  'pnpm i18n:check',
  'pnpm typecheck',
  'pnpm test',
  'pnpm build',
  'pnpm exec playwright test',
]

export function validateCiWorkflow(source) {
  const document = parseDocument(source, {
    prettyErrors: true,
    uniqueKeys: true,
  })
  if (document.errors.length)
    return document.errors.map((error) => error.message)
  const workflow = document.toJS()
  const errors = []
  const events = workflow?.on
  const pushBranches = events?.push?.branches
  if (!Array.isArray(pushBranches) || !pushBranches.includes('main'))
    errors.push('CI must run for pushes to main')
  if (!events || !Object.prototype.hasOwnProperty.call(events, 'pull_request'))
    errors.push('CI must run for pull requests')
  const jobs = Object.values(workflow?.jobs ?? {})
  if (!jobs.length) errors.push('CI must define at least one job')
  const commands = jobs.flatMap((job) =>
    Array.isArray(job?.steps)
      ? job.steps.map((step) => step?.run).filter(Boolean)
      : [],
  )
  for (const required of REQUIRED_VALIDATION_COMMANDS)
    if (!commands.includes(required))
      errors.push(`CI validation command is missing: ${required}`)
  return errors
}

export function checkWorkflowDirectory(directory) {
  const files = readdirSync(directory).filter((name) => /\.ya?ml$/i.test(name))
  if (!files.length) return ['No GitHub Actions workflow files were found']
  const errors = []
  for (const file of files) {
    const source = readFileSync(join(directory, file), 'utf8')
    const syntax = parseDocument(source, {
      prettyErrors: true,
      uniqueKeys: true,
    })
    for (const error of syntax.errors) errors.push(`${file}: ${error.message}`)
    if (file === 'ci.yml' || file === 'ci.yaml')
      for (const error of validateCiWorkflow(source))
        errors.push(`${file}: ${error}`)
  }
  if (!files.some((file) => /^ci\.ya?ml$/i.test(file)))
    errors.push('The required CI workflow file is missing')
  return errors
}

const invoked =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const errors = checkWorkflowDirectory(join(root, '.github', 'workflows'))
  if (errors.length) {
    console.error(
      ['CI workflow policy failed:', ...errors.map((item) => `- ${item}`)].join(
        '\n',
      ),
    )
    process.exitCode = 1
  } else console.log('CI workflow configuration is valid.')
}
