import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

export const requiredBuildInputs = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  'apps/api/package.json',
  'apps/web/package.json',
  'packages/auth/package.json',
  'packages/database/package.json',
  'packages/database/prisma/schema.prisma',
  'packages/shared/package.json',
]
export const forbiddenContextInputs = [
  '.env',
  '.env.*',
  '**/node_modules',
  'knowledge',
  '.backups',
  'uploads',
]

export async function validateContainerContext(
  root = new URL('../', import.meta.url),
) {
  await Promise.all(
    requiredBuildInputs.map((path) => access(new URL(path, root))),
  )
  const ignore = (await readFile(new URL('.dockerignore', root), 'utf8')).split(
    /\r?\n/,
  )
  for (const path of forbiddenContextInputs)
    assert.ok(ignore.includes(path), `.dockerignore must exclude ${path}`)
  for (const dockerfile of ['Dockerfile.api', 'Dockerfile.web']) {
    const source = await readFile(new URL(dockerfile, root), 'utf8')
    for (const path of [
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'tsconfig.base.json',
    ])
      assert.match(
        source,
        new RegExp(`COPY [^\\n]*${path.replace('.', '\\.')}`),
        `${dockerfile} must copy ${path}`,
      )
  }
}

await validateContainerContext()
process.stdout.write(
  'Container build context is complete and excludes forbidden inputs.\n',
)
