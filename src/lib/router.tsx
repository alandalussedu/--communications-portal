import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

export type Route =
  | { page: "overview" }
  | { page: "reports" }
  | { page: "branch"; slug: string }
  | { page: "library"; section?: string }
  | { page: "indicators" }
  | { page: "sources" }
  | { page: "builder" }
  | { page: "alerts" }
  | { page: "social" }
  | { page: "calendar" }
  | { page: "remedial"; slug?: string }
  | { page: "competitors" }

const TOKENS = ["overview", "indicators", "reports", "library", "sources", "builder", "alerts", "social", "remedial", "calendar", "competitors"] as const

/** Pages behind the password (the «المؤشرات» tab and everything under it). */
export const LOCKED_PAGES: Route["page"][] = ["indicators", "reports", "branch", "remedial", "builder", "alerts", "sources", "competitors"]

/** Only bare tokens survive in the artifact's address, so each page has one. */
export function routeToken(r: Route): string {
  if (r.page === "remedial") return r.slug ? `remedial-${r.slug}` : "remedial"
  if (r.page === "library") return r.section ? `library-${r.section}` : "library"
  return r.page === "branch" ? `branch-${r.slug}` : r.page
}

function parse(hash: string): Route {
  const t = hash.replace(/^#/, "")
  if (t.startsWith("branch-") && t.length > 7) return { page: "branch", slug: t.slice(7) }
  if (t.startsWith("remedial-") && t.length > 9) return { page: "remedial", slug: t.slice(9) }
  if (t.startsWith("library-") && t.length > 8) return { page: "library", section: t.slice(8) }
  if ((TOKENS as readonly string[]).includes(t)) return { page: t as (typeof TOKENS)[number] } as Route
  return { page: "overview" }
}

type Nav = { route: Route; nonce: number; go: (r: Route) => void }
const RouterCtx = createContext<Nav | null>(null)

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => {
    try {
      return parse(window.location.hash)
    } catch {
      return { page: "overview" }
    }
  })

  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const onHash = () => {
      setRoute(parse(window.location.hash))
      setNonce((n) => n + 1)
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  const go = useCallback((r: Route) => {
    setRoute(r)
    setNonce((n) => n + 1)
    try {
      history.replaceState(null, "", `#${routeToken(r)}`)
    } catch {
      /* the viewer may refuse address changes; navigation still works */
    }
    window.scrollTo({ top: 0, behavior: "auto" })
  }, [])

  const value = useMemo(() => ({ route, nonce, go }), [route, nonce, go])
  return <RouterCtx.Provider value={value}>{children}</RouterCtx.Provider>
}

export function useRouter(): Nav {
  const v = useContext(RouterCtx)
  if (!v) throw new Error("useRouter outside RouterProvider")
  return v
}
