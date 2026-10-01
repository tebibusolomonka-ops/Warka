import { useEffect, useState } from 'react'

export type NetworkState = {
  browser: 'online' | 'offline'
  server: 'unknown' | 'reachable' | 'unreachable'
  effectiveType?: string
}
export function observedNetworkState(): NetworkState {
  const connection = (
    navigator as Navigator & { connection?: { effectiveType?: string } }
  ).connection
  return {
    browser: navigator.onLine ? 'online' : 'offline',
    server: 'unknown',
    ...(connection?.effectiveType
      ? { effectiveType: connection.effectiveType }
      : {}),
  }
}
export function useNetworkState(healthUrl?: string) {
  const [state, setState] = useState<NetworkState>(observedNetworkState)
  useEffect(() => {
    const update = () => setState(observedNetworkState())
    addEventListener('online', update)
    addEventListener('offline', update)
    if (healthUrl && navigator.onLine)
      fetch(healthUrl, { cache: 'no-store' })
        .then((response) =>
          setState((current) => ({
            ...current,
            server: response.ok ? 'reachable' : 'unreachable',
          })),
        )
        .catch(() =>
          setState((current) => ({ ...current, server: 'unreachable' })),
        )
    return () => {
      removeEventListener('online', update)
      removeEventListener('offline', update)
    }
  }, [healthUrl])
  return state
}
