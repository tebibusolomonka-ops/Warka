import { readFile } from 'node:fs/promises'

export function validateReleaseVersion(value) {
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(
      value,
    )
  )
    throw new Error('Release version must be semantic versioning')
  return value
}

export async function readReleaseVersion() {
  const source = JSON.parse(
    await readFile(new URL('../release/version.json', import.meta.url), 'utf8'),
  )
  return validateReleaseVersion(source.version)
}

const version = await readReleaseVersion()
if (process.argv.includes('--check')) {
  const root = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  )
  if (root.version !== version)
    throw new Error('Root package and release version differ')
}
process.stdout.write(`${version}\n`)
