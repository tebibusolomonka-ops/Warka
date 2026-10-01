import { loadSecretFiles } from './secretFiles.js'

await loadSecretFiles(process.env)
await import('./server.js')
