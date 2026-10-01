export const faultPoints = [
  'database.operation',
  'storage.operation',
  'email.delivery',
  'scanner.scan',
  'worker.interruption',
  'transaction.commit',
] as const

export type FaultPoint = (typeof faultPoints)[number]

export class InjectedFault extends Error {
  constructor(readonly point: FaultPoint) {
    super(`Injected test fault: ${point}`)
    this.name = 'InjectedFault'
  }
}

/** Instance-scoped, deterministic faults for tests. Never construct from request data. */
export class FaultController {
  readonly #remaining = new Map<FaultPoint, number>()

  constructor(environment: string = process.env.NODE_ENV ?? 'development') {
    if (environment === 'production') {
      throw new Error('Fault injection is unavailable in production')
    }
  }

  enable(point: FaultPoint, count = 1): void {
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new Error('Fault count must be a positive integer')
    }
    this.#remaining.set(point, count)
  }

  hit(point: FaultPoint): void {
    const remaining = this.#remaining.get(point) ?? 0
    if (remaining === 0) return
    if (remaining === 1) this.#remaining.delete(point)
    else this.#remaining.set(point, remaining - 1)
    throw new InjectedFault(point)
  }

  reset(): void {
    this.#remaining.clear()
  }
}
