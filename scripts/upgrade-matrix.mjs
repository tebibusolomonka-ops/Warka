import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('tests/fixtures/migrations')
const manifest = JSON.parse(
  await readFile(path.join(root, 'manifest.json'), 'utf8'),
)
const results = []
for (const fixture of manifest.fixtures) {
  const data = JSON.parse(await readFile(path.join(root, fixture.data), 'utf8'))
  const preservedAliases = Object.values(data)
    .filter(Array.isArray)
    .flat()
    .map((record) => record.alias)
    .filter(Boolean)
  results.push({
    fixture: fixture.id,
    synthetic: data.synthetic === true,
    preservedAliases,
  })
}
if (
  results.some(
    (result) => !result.synthetic || result.preservedAliases.length === 0,
  )
)
  process.exitCode = 1
console.log(JSON.stringify({ ok: !process.exitCode, results }))
