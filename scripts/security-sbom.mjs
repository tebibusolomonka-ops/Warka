import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function validateSbom(document) {
  const errors = []
  if (document.bomFormat !== 'CycloneDX')
    errors.push('SBOM format must be CycloneDX')
  if (!document.specVersion) errors.push('SBOM specVersion is missing')
  if (!Array.isArray(document.components) || document.components.length === 0)
    errors.push('SBOM has no components')
  for (const component of document.components ?? [])
    if (!component.name || !component.version)
      errors.push('SBOM component identity is incomplete')
  return errors
}

function main() {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const fileName = `.warka-sbom-${process.pid}.cdx.json`
  const output = join(root, fileName)
  try {
    const executable =
      process.platform === 'win32' ? process.env.ComSpec : 'pnpm'
    const args =
      process.platform === 'win32'
        ? [
            '/d',
            '/s',
            '/c',
            `pnpm exec cdxgen -t js --no-install-deps --validate --spec-version 1.6 -o ${fileName} .`,
          ]
        : [
            'exec',
            'cdxgen',
            '-t',
            'js',
            '--no-install-deps',
            '--validate',
            '--spec-version',
            '1.6',
            '-o',
            output,
            '.',
          ]
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) =>
          name !== 'NODE_PATH' && !/(?:TOKEN|KEY|SECRET|PASSWORD)$/i.test(name),
      ),
    )
    execFileSync(executable, args, { cwd: root, env, stdio: 'inherit' })
    const document = JSON.parse(readFileSync(output, 'utf8'))
    const errors = validateSbom(document)
    if (errors.length) throw new Error(errors.join('\n'))
    console.log(
      `CycloneDX ${document.specVersion} SBOM validated (${document.components.length} components).`,
    )
  } finally {
    rmSync(output, { force: true })
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  main()
