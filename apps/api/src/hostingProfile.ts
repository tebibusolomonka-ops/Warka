export type HostingProfile = 'singleHost' | 'managedServices'

export function hostingProfile(env: NodeJS.ProcessEnv): HostingProfile {
  const value = env.WARKA_HOSTING_PROFILE ?? 'singleHost'
  if (value !== 'singleHost' && value !== 'managedServices')
    throw new Error(
      'WARKA_HOSTING_PROFILE must be singleHost or managedServices',
    )
  return value
}

export function validateHostingProfile(env: NodeJS.ProcessEnv) {
  const profile = hostingProfile(env)
  const missing: string[] = []
  const requireValue = (key: string) => {
    if (!env[key] && !env[`${key}_FILE`]) missing.push(key)
  }
  requireValue('DATABASE_URL')
  if (profile === 'managedServices') {
    requireValue('OBJECT_STORAGE_SECRET_KEY')
    if (!env.OBJECT_STORAGE_ENDPOINT) missing.push('OBJECT_STORAGE_ENDPOINT')
    if (!env.SMTP_HOST) missing.push('SMTP_HOST')
    requireValue('SMTP_PASSWORD')
    if (!env.CLAMAV_HOST) missing.push('CLAMAV_HOST')
  }
  return { profile, missing }
}
