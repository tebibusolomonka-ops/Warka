export function createApplicationShutdown(input: {
  stopWorkers: Array<{ stop: () => Promise<void> } | undefined>
  closeServer: () => Promise<void>
  onTimeout: () => void
  drainMs?: number
}) {
  let running: Promise<void> | undefined
  return () => {
    running ??= (async () => {
      const timeout = setTimeout(input.onTimeout, input.drainMs ?? 30_000)
      timeout.unref()
      try {
        await Promise.all(input.stopWorkers.map((worker) => worker?.stop()))
        await input.closeServer()
      } finally {
        clearTimeout(timeout)
      }
    })()
    return running
  }
}
