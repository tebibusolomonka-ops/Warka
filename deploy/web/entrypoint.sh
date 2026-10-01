#!/bin/sh
set -eu
api_base="${WARKA_PUBLIC_API_BASE_URL:-/api}"
case "$api_base" in
  /api|/api/) ;;
  *) echo "WARKA_PUBLIC_API_BASE_URL must be /api or /api/" >&2; exit 1 ;;
esac
release_version="${WARKA_RELEASE_VERSION:-0.1.0}"
printf 'window.__WARKA_PUBLIC_CONFIG__={apiBaseUrl:"%s",releaseVersion:"%s"};\n' "$api_base" "$release_version" > /usr/share/nginx/html/config.js
