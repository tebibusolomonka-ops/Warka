#!/bin/sh
set -eu
api_base="${WARKA_PUBLIC_API_BASE_URL:-/api}"
case "$api_base" in
  /api|/api/) ;;
  *) echo "WARKA_PUBLIC_API_BASE_URL must be /api or /api/" >&2; exit 1 ;;
esac
printf 'window.__WARKA_PUBLIC_CONFIG__={apiBaseUrl:"%s"};\n' "$api_base" > /usr/share/nginx/html/config.js
