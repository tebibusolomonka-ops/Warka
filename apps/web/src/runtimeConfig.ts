declare global {
  interface Window {
    __WARKA_PUBLIC_CONFIG__?: { apiBaseUrl?: string; releaseVersion?: string }
  }
}

export function publicApiBaseUrl(
  buildValue: string | undefined,
): string | undefined {
  return window.__WARKA_PUBLIC_CONFIG__?.apiBaseUrl ?? buildValue
}
