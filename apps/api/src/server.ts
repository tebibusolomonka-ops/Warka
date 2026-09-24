import { buildApp } from './app.js'
import { serverConfig } from './config.js'

const app = buildApp()

try {
  await app.listen(serverConfig(process.env))
} catch (error) {
  app.log.error(error)
  process.exitCode = 1
}
