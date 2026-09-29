import { environmentProfile } from './environmentProfile.js'

export type BuildMetadata = {
  version: string
  commitSha: string | null
  builtAt: string | null
  environment: 'development' | 'test' | 'production'
}

export function buildMetadata(env: NodeJS.ProcessEnv): BuildMetadata {
  const commitSha = env.WARKA_BUILD_COMMIT_SHA ?? ''
  const builtAt = env.WARKA_BUILD_TIMESTAMP ?? ''
  return {
    version: '0.1.0',
    commitSha: /^[0-9a-f]{40}$/i.test(commitSha) ? commitSha : null,
    builtAt:
      builtAt && !Number.isNaN(Date.parse(builtAt))
        ? new Date(builtAt).toISOString()
        : null,
    environment: environmentProfile(env).name,
  }
}
