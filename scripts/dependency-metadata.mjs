import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function evaluateMetadata(packages, policy) {
  const exceptions = policy.exceptions ?? []
  const errors = []
  for (const entry of exceptions) {
    if (!entry.package || !entry.reason || !entry.reviewContext)
      errors.push('Metadata exception is incomplete')
  }
  const warnings = packages
    .filter((item) => !item.license)
    .map((item) => ({
      ...item,
      documented: exceptions.some((entry) => entry.package === item.name),
    }))
  for (const item of warnings.filter((warning) => !warning.documented))
    errors.push(
      `Missing license metadata without exception: ${item.name}@${item.version}`,
    )
  return { errors, warnings }
}

function packageManifests(root) {
  const store = join(root, 'node_modules', '.pnpm')
  const records = []
  for (const folder of readdirSync(store)) {
    const modules = join(store, folder, 'node_modules')
    if (!statSync(modules, { throwIfNoEntry: false })?.isDirectory()) continue
    for (const name of readdirSync(modules)) {
      const base = join(modules, name)
      const candidates = name.startsWith('@')
        ? readdirSync(base).map((child) => join(base, child, 'package.json'))
        : [join(base, 'package.json')]
      for (const candidate of candidates) {
        try {
          const manifest = JSON.parse(readFileSync(candidate, 'utf8'))
          records.push({
            name: manifest.name,
            version: manifest.version,
            license: manifest.license ?? null,
          })
        } catch {}
      }
    }
  }
  return [
    ...new Map(
      records.map((item) => [`${item.name}@${item.version}`, item]),
    ).values(),
  ].sort((a, b) =>
    `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`),
  )
}

function directNames(root) {
  const manifests = [join(root, 'package.json')]
  for (const area of ['apps', 'packages'])
    for (const name of readdirSync(join(root, area)))
      manifests.push(join(root, area, name, 'package.json'))
  const names = new Set()
  for (const path of manifests) {
    try {
      const item = JSON.parse(readFileSync(path, 'utf8'))
      for (const section of [
        'dependencies',
        'devDependencies',
        'optionalDependencies',
      ])
        Object.keys(item[section] ?? {}).forEach((name) => names.add(name))
    } catch {}
  }
  return names
}

function main() {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const policy = JSON.parse(
    readFileSync(
      new URL(
        '../security/dependency-metadata-exceptions.json',
        import.meta.url,
      ),
    ),
  )
  const direct = directNames(root)
  const packages = packageManifests(root).map((item) => ({
    ...item,
    relationship: direct.has(item.name) ? 'direct' : 'transitive',
  }))
  const result = evaluateMetadata(packages, policy)
  console.log(
    JSON.stringify(
      {
        generatedFrom: 'installed locked dependency graph',
        packageCount: packages.length,
        warningCount: result.warnings.length,
        warnings: result.warnings,
        packages,
      },
      null,
      2,
    ),
  )
  if (result.errors.length) {
    console.error(result.errors.join('\n'))
    process.exitCode = 1
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  main()
