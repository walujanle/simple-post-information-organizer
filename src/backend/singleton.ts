// Concurrency-safe lazy singleton (CWE-362).
//
// A plain `if (instance) return instance` guard is unsafe when the factory
// awaits: two concurrent cold-start requests both pass the guard and each
// builds its own connection pool, leaking whichever one loses the assignment
// race. Memoising the *promise* means concurrent callers share one in-flight
// initialisation. A rejected init is evicted so a later request can retry.
const pending = new Map<string, Promise<unknown>>()

export function initOnce<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = pending.get(key) as Promise<T> | undefined
  if (existing) return existing

  const created = factory().catch((err: unknown) => {
    pending.delete(key)
    throw err
  })
  pending.set(key, created)
  return created
}
