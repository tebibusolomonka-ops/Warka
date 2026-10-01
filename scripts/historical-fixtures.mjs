import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../tests/fixtures/migrations',
)
const manifest = JSON.parse(
  await readFile(path.join(root, 'manifest.json'), 'utf8'),
)
for (const fixture of manifest.fixtures) {
  const data = JSON.parse(await readFile(path.join(root, fixture.data), 'utf8'))
  if (data.synthetic !== true)
    throw new Error(`${fixture.id} is not marked synthetic`)
}
console.log(
  JSON.stringify({
    ok: true,
    fixtures: manifest.fixtures.map(({ id, schemaVersion }) => ({
      id,
      schemaVersion,
    })),
  }),
)
