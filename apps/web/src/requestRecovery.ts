export class AmbiguousMutationError extends Error {
  readonly resultUnknown = true
}
export async function retrySafeRead<T>(read: () => Promise<T>, attempts = 2) {
  let error: unknown
  for (let attempt = 0; attempt < attempts; attempt += 1)
    try {
      return await read()
    } catch (caught) {
      error = caught
    }
  throw error
}
export async function runMutationOnce<T>(mutation: () => Promise<T>) {
  try {
    return await mutation()
  } catch {
    throw new AmbiguousMutationError(
      'Connection lost. Refresh status before retrying this action.',
    )
  }
}
