export type EnvironmentProfile = {
  name: 'development' | 'test' | 'production'
  logging: 'debug' | 'warn' | 'info'
  secureCookies: boolean
  defaultFileStorage: 'local' | 's3'
  deterministicAdapters: boolean
  externalProvidersRequired: boolean
  schedulerDefaultEnabled: boolean
}

export function environmentProfile(env: NodeJS.ProcessEnv): EnvironmentProfile {
  const name = env.NODE_ENV ?? 'development'
  if (name === 'production')
    return {
      name,
      logging: 'info',
      secureCookies: true,
      defaultFileStorage: 's3',
      deterministicAdapters: false,
      externalProvidersRequired: true,
      schedulerDefaultEnabled: false,
    }
  if (name === 'test')
    return {
      name,
      logging: 'warn',
      secureCookies: false,
      defaultFileStorage: 'local',
      deterministicAdapters: true,
      externalProvidersRequired: false,
      schedulerDefaultEnabled: false,
    }
  if (name === 'development')
    return {
      name,
      logging: 'debug',
      secureCookies: false,
      defaultFileStorage: 'local',
      deterministicAdapters: false,
      externalProvidersRequired: false,
      schedulerDefaultEnabled: false,
    }
  throw new Error('Invalid NODE_ENV')
}
