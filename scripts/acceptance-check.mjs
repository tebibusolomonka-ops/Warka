import { access, readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export async function checkAcceptance(
  path = 'config/acceptance-coverage.json',
) {
  const matrix = JSON.parse(await readFile(path, 'utf8'))
  const results = await Promise.all(
    matrix.capabilities.map(async (capability) => {
      const evidenceExists = await Promise.all(
        capability.evidence.map((file) =>
          access(file).then(
            () => true,
            () => false,
          ),
        ),
      )
      const state = evidenceExists.every(Boolean)
        ? capability.state
        : 'notCovered'
      return { ...capability, state }
    }),
  )
  return {
    ok: !results.some(
      ({ required, state }) => required && state === 'notCovered',
    ),
    capabilities: results,
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await checkAcceptance()
  console.log(JSON.stringify(result))
  if (!result.ok) process.exitCode = 1
}
