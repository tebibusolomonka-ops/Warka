export function trustedProxyConfiguration(
  env: NodeJS.ProcessEnv,
): false | string[] {
  const raw = env.WARKA_TRUSTED_PROXIES?.trim()
  if (!raw) return false
  const entries = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const address =
    /^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$|^[0-9a-f:]+(?:\/\d{1,3})?$/i
  if (!entries.length || entries.some((entry) => !address.test(entry)))
    throw new Error(
      'WARKA_TRUSTED_PROXIES must contain IP addresses or CIDR ranges',
    )
  return entries
}
