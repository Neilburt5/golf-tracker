/**
 * Asks the browser not to evict our IndexedDB data under storage pressure.
 * Safari may ignore or deny it; that is why a JSON backup arrives in phase 7.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage || !navigator.storage.persist) return false
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}