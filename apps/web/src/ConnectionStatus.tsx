import type { NetworkState } from './networkState'

export function ConnectionStatus({
  state,
  onRetry,
}: {
  state: NetworkState
  onRetry: () => void
}) {
  if (state.browser === 'offline')
    return (
      <section role="status" aria-live="polite">
        <h2>Offline</h2>
        <p>
          Server actions cannot be completed. Warka does not store private
          records for offline use.
        </p>
        <button onClick={onRetry}>Retry connection</button>
      </section>
    )
  if (state.server === 'unreachable')
    return (
      <section role="alert">
        <h2>Warka service unavailable</h2>
        <p>Your browser is online, but the Warka server cannot be reached.</p>
        <button onClick={onRetry}>Retry server</button>
      </section>
    )
  return null
}
