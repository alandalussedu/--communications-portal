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
export function backendRuntime(): { kind: "supabase"; use: (name: string) => Promise<unknown> } | null {
  const sb = supabase()
  if (!sb) return null
  return {
    kind: "supabase",
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
          me: async () => {
            const { data } = await sb.rpc("me")
            return (Array.isArray(data) ? data[0] : data) ?? null
          },
        }
      }
      return null
    },
  }
}

/* ------------------------------------------------------------ sign-in */
/**
 * Members sign in with their mobile number. Supabase accounts are keyed by an
 * internal address made from the number, so no SMS service is needed and no
 * mail is ever sent. 05XXXXXXXX, 5XXXXXXXX, 9665XXXXXXXX and +9665XXXXXXXX all
 * give the same account.
 */
export function normalizePhone(input: string): string | null {
  const d = input.replace(/[\s\-()]/g, "").replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/^\+/, "").replace(/^00/, "")
  if (/^05\d{8}$/.test(d)) return "966" + d.slice(1)
  if (/^5\d{8}$/.test(d)) return "966" + d
  if (/^9665\d{8}$/.test(d)) return d
  return null
}
export const phoneLogin = (phone966: string) => `m${phone966}@members.andalus.invalid`

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

export async function signIn(phoneInput: string, password: string): Promise<string | null> {
  const sb = supabase()
  if (!sb) return "قاعدة البيانات غير مهيأة."
  const phone = normalizePhone(phoneInput)
  if (!phone) return "اكتب رقم الجوال بالشكل 05XXXXXXXX."
  const { error } = await sb.auth.signInWithPassword({ email: phoneLogin(phone), password })
  if (!error) return null
  if (/invalid login|invalid credentials/i.test(error.message)) return "رقم الجوال أو كلمة المرور غير صحيحة."
  if (/banned|disabled/i.test(error.message)) return "هذا الحساب موقوف. تواصل مع إدارة التواصل المؤسسي."
  if (/rate|too many/i.test(error.message)) return "محاولات كثيرة. انتظر دقائق ثم أعد المحاولة."
  return "تعذّر تسجيل الدخول. تحقق من الاتصال ثم أعد المحاولة."
}

export async function signOut(): Promise<void> {
  await supabase()?.auth.signOut()
}

/** Sets a new password and clears the «must change» mark. */
export async function changeMyPassword(password: string): Promise<string | null> {
  const sb = supabase()
  if (!sb) return "قاعدة البيانات غير مهيأة."
  const { error } = await sb.auth.updateUser({ password })
  if (error) {
    if (/same.*password|different from the old/i.test(error.message)) return "اختر كلمة مرور مختلفة عن الحالية."
    if (/weak|short|at least/i.test(error.message)) return "كلمة المرور قصيرة. استخدم 8 أحرف أو أرقام على الأقل."
    return "لم تتغيّر كلمة المرور. أعد المحاولة."
  }
  const res = await sb.rpc("password_changed")
  return res.error ? "تغيّرت كلمة المرور، لكن تعذّر تحديث الحساب. أعد تحميل الصفحة." : null
}

/* ------------------------------------------------------------ members admin */
export type MemberRow = { user_id: string; name: string; phone: string; role: "viewer" | "editor" | "owner"; active: boolean; must_change_password: boolean; created_at: string; last_sign_in_at: string | null }
type AdminReq =
  | { action: "list" }
  | { action: "create"; name: string; phone: string; role: MemberRow["role"] }
  | { action: "reset"; user_id: string }
  | { action: "update"; user_id: string; role?: MemberRow["role"]; active?: boolean; name?: string }

/** Calls the admin-members function (owners only; the function checks). */
export async function adminMembers<T = unknown>(req: AdminReq): Promise<{ data?: T; error?: string }> {
  const sb = supabase()
  if (!sb) return { error: "قاعدة البيانات غير مهيأة." }
  const { data, error } = await sb.functions.invoke("admin-members", { body: req })
  if (error) {
    let msg = "تعذّر تنفيذ الطلب. أعد المحاولة."
    try {
      const body = await (error as { context?: Response }).context?.json()
      if (body?.error) msg = body.error
    } catch {
      /* keep the generic message */
    }
    return { error: msg }
  }
  return { data: data as T }
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
