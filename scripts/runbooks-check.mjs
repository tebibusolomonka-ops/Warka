import { readdir, readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export async function checkRunbooks(directory = 'knowledge/Runbooks') {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
  const files = (await readdir(directory))
    .filter((file) => file.endsWith('.md'))
    .sort()
  const results = []
  for (const file of files) {
    const text = await readFile(`${directory}/${file}`, 'utf8')
    const commands = [...text.matchAll(/^Command: `pnpm ([^` ]+)/gm)].map(
      (match) => match[1],
    )
    const missingSections = [
      '## Purpose',
      '## Preconditions',
      '## Actions',
      '## Verification',
      '## Stop and escalate',
    ].filter((heading) => !text.includes(heading))
    const missingCommands = commands.filter(
      (command) => !packageJson.scripts[command],
    )
    results.push({ file, commands, missingSections, missingCommands })
  }
  return {
    ok:
      files.length === 9 &&
      results.every(
        (result) =>
          result.missingSections.length === 0 &&
          result.missingCommands.length === 0,
      ),
    results,
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await checkRunbooks()
  console.log(JSON.stringify(result))
  if (!result.ok) process.exitCode = 1
}
