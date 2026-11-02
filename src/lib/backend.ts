/**
 * The platform's database outside Claude: Supabase, shaped like the Claude
 * runtime the store already speaks to (`use("db")` and `use("user")`), so the
 * pages and the store work unchanged.
 */
import { createClient, type RealtimePostgresChangesPayload, type Session, type SupabaseClient } from "@supabase/supabase-js"
import { useEffect, useState } from "react"
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/config"

type Snap = { docs: { id: string; data(): Record<string, unknown> | undefined }[] }
type DbError = { code: string; message: string }
type Row = { collection: string; id: string; data: Record<string, unknown> }

export const backendConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY)

let client: SupabaseClient | null = null
export function supabase(): SupabaseClient | null {
  if (!backendConfigured) return null
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  return client
}

const asError = (e: { code?: string; message?: string } | null | undefined): DbError => ({
  code: e?.code === "42501" || /row-level security|permission/i.test(e?.message ?? "") ? "permission-denied" : e?.code ?? "unavailable",
  message: e?.message ?? "تعذّر الاتصال بقاعدة البيانات.",
})

function splitPath(path: string): [string, string] {
  const i = path.lastIndexOf("/")
  return [path.slice(0, i), path.slice(i + 1)]
}

/* ------------------------------------------------------------ live changes */
type Listener = (p: RealtimePostgresChangesPayload<Row>) => void
const listeners = new Set<Listener>()
let channelOpen = false
function onChange(sb: SupabaseClient, fn: Listener): () => void {
  listeners.add(fn)
  if (!channelOpen) {
    channelOpen = true
    // One channel for the whole table: delete events cannot be filtered server-side.
    sb.channel("docs-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "docs" }, (p) => listeners.forEach((l) => l(p as RealtimePostgresChangesPayload<Row>)))
      .subscribe()
  }
  return () => listeners.delete(fn)
}

/* ------------------------------------------------------------ db */
function makeDb(sb: SupabaseClient) {
  const read = async (collection: string, n: number): Promise<Row[]> => {
    const { data, error } = await sb.from("docs").select("collection,id,data").eq("collection", collection).order("id").limit(n)
    if (error) throw asError(error)
    return (data ?? []) as Row[]
  }
  const snap = (rows: Iterable<Row>): Snap => ({ docs: [...rows].map((r) => ({ id: r.id, data: () => r.data })) })

  return {
    collection(collection: string) {
      return {
        limit(n: number) {
          return {
            get: async () => snap(await read(collection, n)),
            onSnapshot(next: (s: Snap) => void, err: (e: DbError) => void) {
              const rows = new Map<string, Row>()
              let live = true
              let ready = false
              const emit = () => live && ready && next(snap([...rows.values()].sort((a, b) => a.id.localeCompare(b.id))))
              // listen first so nothing is missed between the read and the subscription
              const off = onChange(sb, (p) => {
                const rec = (p.eventType === "DELETE" ? p.old : p.new) as Partial<Row>
                if (rec.collection !== collection || !rec.id) return
                if (p.eventType === "DELETE") rows.delete(rec.id)
                else rows.set(rec.id, rec as Row)
                emit()
              })
              read(collection, n)
                .then((list) => {
                  for (const r of list) if (!rows.has(r.id)) rows.set(r.id, r)
                  ready = true
                  emit()
                })
                .catch((e) => live && err(e as DbError))
              return () => {
                live = false
                off()
              }
            },
          }
        },
      }
    },
    doc(path: string) {
      const [collection, id] = splitPath(path)
      return {
        async set(d: Record<string, unknown>) {
          const { error } = await sb.from("docs").upsert({ collection, id, data: d }, { onConflict: "collection,id" })
          if (error) throw asError(error)
        },
        async update(d: Record<string, unknown>) {
          const { data, error } = await sb.from("docs").select("data").eq("collection", collection).eq("id", id).maybeSingle()
          if (error) throw asError(error)
          const merged = { ...((data?.data as Record<string, unknown>) ?? {}), ...d }
          const res = await sb.from("docs").upsert({ collection, id, data: merged }, { onConflict: "collection,id" })
          if (res.error) throw asError(res.error)
        },
        async delete() {
          const { error } = await sb.from("docs").delete().eq("collection", collection).eq("id", id)
          if (error) throw asError(error)
        },
      }
    },
  }
}

/* ------------------------------------------------------------ runtime */
/** The same shape as `window.claude`, backed by Supabase. */
export function backendRuntime(): { use: (name: string) => Promise<unknown> } | null {
  const sb = supabase()
  if (!sb) return null
  return {
    async use(name: string) {
      if (name === "db") {
        // a quick read proves the project answers; otherwise the store falls back to public-data.json
        const { error } = await sb.from("docs").select("id").limit(1)
        if (error) return null
        return makeDb(sb)
      }
      if (name === "user") {
        return {
          canEdit: async () => (await sb.rpc("is_editor")).data === true,
          isOwner: async () => (await sb.rpc("is_owner")).data === true,
        }
      }
      return null
    },
  }
}

/* ------------------------------------------------------------ sign-in */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(backendConfigured ? undefined : null)
  useEffect(() => {
    const sb = supabase()
    if (!sb) return
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const sb = supabase()
  if (!sb) return "قاعدة البيانات غير مهيأة."
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
  if (!error) return null
  if (/invalid login/i.test(error.message)) return "البريد أو كلمة المرور غير صحيحة."
  if (/not confirmed/i.test(error.message)) return "لم يُفعَّل الحساب بعد. افتح رسالة التفعيل في بريدك."
  return "تعذّر تسجيل الدخول. تحقق من الاتصال ثم أعد المحاولة."
}

export async function signOut(): Promise<void> {
  await supabase()?.auth.signOut()
}

/** Calls `fn` whenever someone signs in or out (not on token refresh). */
export function onSignInChange(fn: () => void): () => void {
  const sb = supabase()
  if (!sb) return () => {}
  let last: string | null | undefined
  const { data } = sb.auth.onAuthStateChange((_e, s) => {
    const id = s?.user.id ?? null
    if (last !== undefined && id !== last) fn()
    last = id
  })
  return () => data.subscription.unsubscribe()
}
