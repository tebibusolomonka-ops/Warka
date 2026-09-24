export function serverConfig(env: NodeJS.ProcessEnv) {
  const host = env.HOST || '127.0.0.1'
  const port = Number(env.PORT || 3000)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535')
  }

  return { host, port }
}
