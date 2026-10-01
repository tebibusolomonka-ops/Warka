export async function assertAtomic<T>(
  initial: T,
  execute: (draft: T) => Promise<void>,
  clone: (value: T) => T = structuredClone,
): Promise<{ committed: boolean; value: T }> {
  const draft = clone(initial)
  try {
    await execute(draft)
    return { committed: true, value: draft }
  } catch {
    return { committed: false, value: initial }
  }
}
