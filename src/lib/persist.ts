import { useEffect, useState } from "react"

/**
 * State that survives moving to a branch page and back within the same visit,
 * so filters and the chosen period are kept. Falls back to plain state when
 * browser storage is unavailable.
 */
export function usePersistent<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(`hub:${key}`)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(`hub:${key}`, JSON.stringify(v))
    } catch {
      /* storage blocked: the value still works for this page */
    }
  }, [key, v])
  return [v, setV]
}
