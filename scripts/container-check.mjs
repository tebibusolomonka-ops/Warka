import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const api = await readFile(
  new URL('../Dockerfile.api', import.meta.url),
  'utf8',
)
const web = await readFile(
  new URL('../Dockerfile.web', import.meta.url),
  'utf8',
)
const nginx = await readFile(
  new URL('../deploy/web/nginx.conf', import.meta.url),
  'utf8',
)
const compose = await readFile(
  new URL('../compose.production.yml', import.meta.url),
  'utf8',
)
const ignore = await readFile(
  new URL('../.dockerignore', import.meta.url),
  'utf8',
)
const caddy = await readFile(
  new URL('../deploy/gateway/Caddyfile', import.meta.url),
  'utf8',
)

assert.match(api, /pnpm install --frozen-lockfile/)
assert.match(api, /pnpm db:generate/)
assert.match(api, /pnpm build:api/)
assert.match(api, /deploy --prod/)
assert.match(api, /CMD \["node", "dist\/bootstrap\.js"\]/)
assert.doesNotMatch(api, /migrate (dev|deploy)|db:deploy/)
assert.match(web, /pnpm build:web/)
assert.match(web, /nginxinc\/nginx-unprivileged:1\.29\.1-alpine/)
assert.doesNotMatch(web, /vite.*--host|pnpm.*dev/)
assert.match(nginx, /try_files \$uri \$uri\/ \/index\.html/)
assert.match(nginx, /max-age=31536000, immutable/)
assert.match(nginx, /no-cache/)
assert.match(api, /USER node/)
assert.match(web, /USER 101/)
assert.match(api, /HEALTHCHECK/)
assert.match(web, /HEALTHCHECK/)
for (const image of [api, web]) {
  assert.match(image, /org\.opencontainers\.image\.version=\$WARKA_RELEASE_VERSION/)
  assert.match(image, /org\.opencontainers\.image\.revision=\$WARKA_REVISION/)
  assert.match(image, /org\.opencontainers\.image\.created=\$WARKA_BUILD_CREATED/)
  assert.match(image, /org\.opencontainers\.image\.source=\$WARKA_SOURCE_URL/)
}
assert.doesNotMatch(api, /--privileged|sudo /)
assert.doesNotMatch(web, /--privileged|sudo /)
assert.doesNotMatch(compose, /^\s+ports:[\s\S]{0,100}postgres/m)
assert.match(compose, /postgres_data:/)
assert.match(compose, /file_data:/)
assert.match(compose, /read_only: true/)
assert.match(compose, /no-new-privileges:true/)
assert.match(caddy, /\{\$WARKA_DOMAIN\}/)
assert.match(caddy, /@api path \/api \/api\/\*/)
assert.match(caddy, /uri strip_prefix \/api/)
assert.match(caddy, /reverse_proxy api:3000/)
assert.match(caddy, /reverse_proxy web:8080/)
assert.match(caddy, /request_body \{[\s\S]*max_size 28MB/)
assert.match(caddy, /flush_interval -1/)
assert.match(caddy, /header_up -X-Forwarded-For/)
assert.match(caddy, /header_up X-Forwarded-For \{remote_host\}/)
assert.match(compose, /WARKA_TRUSTED_PROXIES: 172\.30\.0\.0\/24/)
for (const entry of [
  '.git',
  '.env',
  '**/node_modules',
  'knowledge',
  '.backups',
])
  assert.ok(
    ignore.split(/\r?\n/).includes(entry),
    `.dockerignore must exclude ${entry}`,
  )
