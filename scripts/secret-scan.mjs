import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bghp_[A-Za-z0-9]{36}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /\bsk_live_[A-Za-z0-9]{20,}\b/,
]

export function findSecretPatterns(text) {
  return secretPatterns.flatMap((pattern) =>
    pattern.test(text) ? [pattern.source] : [],
  )
}

function main() {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const files = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean)
  const findings = []
  for (const file of files) {
    if (/\.(?:png|jpg|jpeg|gif|woff2?|pdf|xlsx)$/i.test(file)) continue
    const text = readFileSync(resolve(root, file), 'utf8')
    for (const pattern of findSecretPatterns(text))
      findings.push(`${file}: ${pattern}`)
  }
  if (findings.length) {
    console.error(`Potential committed secrets found:\n${findings.join('\n')}`)
    process.exitCode = 1
  } else
    console.log(`Secret pattern scan passed (${files.length} tracked files).`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  main()
