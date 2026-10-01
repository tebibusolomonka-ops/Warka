import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { validateReleaseVersion } from './release-version.mjs'

export function validateDeploymentManifest(manifest, expectedRevision) {
  validateReleaseVersion(manifest.releaseVersion)
  if (manifest.schemaVersion !== 1)
    throw new Error('Unsupported deployment manifest schema')
  if (!/^[0-9a-f]{40}$/.test(manifest.revision))
    throw new Error('Manifest revision must be a full Git SHA')
  if (expectedRevision && manifest.revision !== expectedRevision)
    throw new Error('Manifest revision mismatch')
  if (!['singleHost', 'managedServices'].includes(manifest.profile))
    throw new Error('Invalid hosting profile')
  if (
    !['none', 'additive', 'incompatible'].includes(
      manifest.migrationCompatibility,
    )
  )
    throw new Error('Invalid migration compatibility')
  for (const image of ['api', 'web'])
    if (
      !String(manifest.images?.[image]).includes(`:${manifest.releaseVersion}`)
    )
      throw new Error(`${image} image does not match release version`)
  return manifest
}

export function manifestChecksum(source) {
  return createHash('sha256').update(source).digest('hex')
}

const source = await readFile(
  new URL('../release/deployment-manifest.json', import.meta.url),
  'utf8',
)
validateDeploymentManifest(
  JSON.parse(source),
  process.env.WARKA_EXPECTED_REVISION,
)
process.stdout.write(
  `Deployment manifest valid: sha256:${manifestChecksum(source)}\n`,
)
