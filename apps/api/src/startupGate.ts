export type StartupGateState = 'pending' | 'ready' | 'blocked'

export class StartupGate {
  #state: StartupGateState = 'pending'
  #reason: string | undefined

  snapshot() {
    return {
      state: this.#state,
      ...(this.#reason ? { reason: this.#reason } : {}),
    }
  }

  async run(check: () => Promise<boolean>, timeoutMs = 15_000) {
    let timer: NodeJS.Timeout | undefined
    try {
      const ready = await Promise.race([
        check(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('startup check timed out')),
            timeoutMs,
          )
        }),
      ])
      this.#state = ready ? 'ready' : 'blocked'
      if (!ready) this.#reason = 'required dependency unavailable'
    } catch (error) {
      this.#state = 'blocked'
      this.#reason =
        error instanceof Error ? error.message : 'startup check failed'
    } finally {
      if (timer) clearTimeout(timer)
    }
    return this.snapshot()
  }
}
