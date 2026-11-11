import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"
import type { BranchContacts, CsrPlan, PbxOfficer, PbxReport, AlertState, Branch, CalendarEvent, CollectionName, ComplaintReport, CsrInitiative, CsrPartner, Competitor, CompetitorsMeta, ConnectionState, FileItem, IndicatorKey, IndicatorSummary, Meta, RemedialFile, RemedialLogEntry, RemedialMonthly, RemedialRow, RemedialStage, RemedialSync, Settings, SocialAccount, SocialReading, StageSummary, SyncEvent } from "./types"
import { buildLink } from "./links"
import { cryptoAvailable, decryptDoc, encryptDoc, fromB64, importDataKey, isEncrypted, keyIdOf, unwrapKey, wrapKey, type VaultDoc } from "@/lib/vault"
import { standalonePage } from "@/lib/runtime"
import { backendConfigured, backendRuntime, onSignInChange, signOut } from "@/lib/backend"

/* ------------------------------------------------------------------ runtime */
// The viewer injects `window.claude`. Outside the viewer it is absent and the
// platform shows a clear "unavailable" state instead of invented data.
type Unsub = () => void
type Snap = { docs: { id: string; data(): Record<string, unknown> | undefined }[] }
type DbError = { code: string; message: string }
type Db = {
  collection(path: string): {
    limit(n: number): {
      onSnapshot(next: (s: Snap) => void, err: (e: DbError) => void): Unsub
      get(): Promise<Snap>
    }
  }
  doc(path: string): {
    set(d: Record<string, unknown>): Promise<void>
    update(d: Record<string, unknown>): Promise<void>
    delete(): Promise<void>
  }
}
type UserNs = { canEdit(): Promise<boolean>; isOwner?(): Promise<boolean>; me?(): Promise<MemberInfo | null> }
type MemberInfo = { name: string; role: MemberRole; must_change_password: boolean }
export type MemberRole = "viewer" | "editor" | "owner"
/** Signed-in member on the public site / app (Supabase). `enabled` is false inside Claude and in the read-only copy. */
export type Member = { enabled: boolean; checked: boolean; role: MemberRole | null; name: string | null; mustChange: boolean; recheck(): void }
type Row = { id: string } & Record<string, unknown>

declare global {
  interface Window {
    claude?: { use: (name: string) => Promise<unknown> }
  }
}

async function waitForRuntime(ms = 4000): Promise<Window["claude"] | null> {
  // outside Claude: the Supabase database when it is set up, otherwise the public copy
  if (!window.claude && standalonePage()) return backendConfigured ? backendRuntime() : null
  const start = Date.now()
  while (Date.now() - start < ms) {
    if (window.claude && typeof window.claude.use === "function") return window.claude
    await new Promise((r) => setTimeout(r, 150))
  }
  return null
}

/* ------------------------------------------------------------------ store */
export type Data = {
  branches: Branch[]
  indicators: IndicatorSummary[]
  stages: StageSummary[]
  files: FileItem[]
  meta: Meta | null
  syncLog: SyncEvent[]
  settings: Settings | null
  alertState: AlertState[]
  socialAccounts: SocialAccount[]
  socialReadings: SocialReading[]
  remedialFiles: RemedialFile[]
  remedialStages: RemedialStage[]
  remedialRows: RemedialRow[]
  remedialMonthly: RemedialMonthly[]
  remedialLog: RemedialLogEntry[]
  remedialSync: RemedialSync[]
  events: CalendarEvent[]
  competitors: Competitor[]
  competitorsMeta: CompetitorsMeta | null
  complaintReports: ComplaintReport[]
  csrInitiatives: CsrInitiative[]
  csrPartners: CsrPartner[]
  pbxOfficers: PbxOfficer[]
  pbxReports: PbxReport[]
  csrPlans: CsrPlan[]
  /** «دليل أرقام الفروع»: the settings document «contacts» (public) */
  contacts: BranchContacts | null
}

const EMPTY: Data = { branches: [], indicators: [], stages: [], files: [], meta: null, syncLog: [], settings: null, alertState: [], socialAccounts: [], socialReadings: [], remedialFiles: [], remedialStages: [], remedialRows: [], remedialMonthly: [], remedialLog: [], remedialSync: [], events: [], competitors: [], competitorsMeta: null, complaintReports: [], csrInitiatives: [], csrPartners: [], pbxOfficers: [], pbxReports: [], csrPlans: [], contacts: null }
const COLLECTIONS: CollectionName[] = ["branches", "indicators", "stages", "files", "meta", "syncLog", "settings", "alertState", "socialAccounts", "socialReadings", "remedialFiles", "remedialStages", "remedialRows", "remedialMonthly", "remedialLog", "remedialSync", "events", "competitors", "competitorsMeta", "complaintReports", "csrInitiatives", "csrPartners", "pbxOfficers", "pbxReports", "csrPlans"]
const NONE_LOADED = Object.fromEntries(COLLECTIONS.map((c) => [c, false])) as Record<CollectionName, boolean>

/**
 * Collections behind the password. Their documents are stored encrypted
 * (`{ enc }`) and only become readable after the vault is opened. A document
 * still in plain form (before the move to encryption) passes through as is.
 */
export const PROTECTED: CollectionName[] = ["branches", "indicators", "stages", "meta", "syncLog", "alertState", "remedialFiles", "remedialStages", "remedialRows", "remedialMonthly", "remedialLog", "remedialSync", "competitors", "competitorsMeta", "complaintReports", "csrInitiatives", "csrPartners", "pbxOfficers", "pbxReports", "csrPlans"]
const PROTECTED_SET = new Set<CollectionName>(PROTECTED)

export type VaultStatus = "loading" | "none" | "locked" | "unlocked" | "unsupported"
export type Vault = {
  status: VaultStatus
  isOwner: boolean
  /** The one-time setup key is present (only the owner can see it). */
  setupReady: boolean
  /** Encrypted documents that are hidden (locked) or could not be opened (wrong key / damaged). */
  hidden: number
  failed: number
  unlock(password: string): Promise<boolean>
  lock(): void
  setup(password: string): Promise<boolean>
  changePassword(oldPassword: string, newPassword: string): Promise<"ok" | "wrong" | "failed">
}

type Store = {
  connection: ConnectionState
  loaded: Record<CollectionName, boolean>
  allLoaded: boolean
  data: Data
  lastSync: Date | null
  canEdit: boolean
  /** Set when the page shows the published public copy (visitor not signed in to Claude): read-only. */
  snapshotAt: string | null
  refresh(): Promise<void>
  reconnect(): void
  saveBranchLinks(slug: string, links: Record<IndicatorKey, string | null>): Promise<boolean>
  saveFile(item: FileItem): Promise<boolean>
  deleteFile(id: string): Promise<boolean>
  saveSettings(patch: Partial<Settings>): Promise<boolean>
  markAlert(id: string, signature: string, done: boolean): Promise<boolean>
  saveSocialAccount(a: SocialAccount): Promise<boolean>
  deleteSocialAccount(id: string): Promise<boolean>
  saveSocialReadings(month: string, entries: { account: string; followers: number | null }[]): Promise<boolean>
  saveFileSections(ids: string[], section: FileItem["section"]): Promise<boolean>
  saveEvent(ev: CalendarEvent): Promise<boolean>
  deleteEvent(id: string): Promise<boolean>
  /** Saves uploaded complaint reports (and each original file) in one go, replacing any for the same branch and month. */
  saveComplaintReports(items: { report: ComplaintReport; file: { name: string; type: string; b64: string } }[]): Promise<boolean>
  deleteComplaintReport(id: string): Promise<boolean>
  saveCsrInitiative(i: CsrInitiative, ok?: string): Promise<boolean>
  deleteCsrInitiative(id: string): Promise<boolean>
  saveCsrPartner(p: CsrPartner, ok?: string): Promise<boolean>
  deleteCsrPartner(id: string): Promise<boolean>
  savePbxReport(r: PbxReport): Promise<boolean>
  deletePbxReport(id: string): Promise<boolean>
  savePbxOfficers(list: PbxOfficer[], removed: string[]): Promise<boolean>
  vault: Vault
  member: Member
}

const Ctx = createContext<Store | null>(null)

const ERROR_TEXT: Record<string, string> = {
  revoked: "توقف وصول هذه الصفحة إلى قاعدة البيانات. أعد فتح المنصة.",
  unavailable: "انقطع الاتصال بقاعدة بيانات المنصة. أعد المحاولة بعد قليل.",
  resource_exhausted: "طلبات كثيرة في وقت قصير. انتظر قليلًا ثم أعد المحاولة.",
  invalid_argument: "لا تملك صلاحية تعديل هذه البيانات، أو أن البيانات المرسلة غير صالحة.",
  locked: "افتح قسم الأداء والتطوير بكلمة المرور أولًا.",
  quota_exceeded: "امتلأت سعة قاعدة بيانات المنصة. احذف عناصر قديمة ثم أعد المحاولة.",
}
const errText = (e: DbError) => ERROR_TEXT[e.code] ?? "حدث خطأ غير متوقع أثناء الاتصال بقاعدة البيانات."

function sortData<K extends keyof Data>(key: K, rows: unknown[]): Data[K] {
  if (key === "meta") return ((rows as Meta[]).find((r) => r.id === "status") ?? (rows[0] as Meta) ?? null) as Data[K]
  if (key === "competitorsMeta") return ((rows as CompetitorsMeta[]).find((r) => r.id === "main") ?? null) as Data[K]
  if (key === "settings") return ((rows as Settings[]).find((r) => r.id === "main") ?? null) as Data[K]
  if (key === "events") return [...(rows as CalendarEvent[])].sort((a, b) => (a.start ?? "").localeCompare(b.start ?? "") || a.id.localeCompare(b.id)) as unknown as Data[K]
  if (key === "syncLog") return [...(rows as SyncEvent[])].sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt)) as unknown as Data[K]
  const list = rows as { order?: number; id: string }[]
  return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id)) as unknown as Data[K]
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<ConnectionState>({ kind: "connecting" })
  const [data, setData] = useState<Data>(EMPTY)
  const [loaded, setLoaded] = useState(NONE_LOADED)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [epoch, setEpoch] = useState(0)
  const dbRef = useRef<Db | null>(null)
  const failedOnce = useRef(false)
  const [isOwner, setIsOwner] = useState(false)
  const [vaultDoc, setVaultDoc] = useState<VaultDoc | null>(null)
  const [vaultLoaded, setVaultLoaded] = useState(false)
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null)
  const [memberMode, setMemberMode] = useState(false)
  const [memberInfo, setMemberInfo] = useState<{ checked: boolean; info: MemberInfo | null }>({ checked: false, info: null })
  const userRef = useRef<UserNs | null>(null)
  const [setupKey, setSetupKey] = useState<{ key: string; keyId: string } | null>(null)
  const [keyOpen, setKeyOpen] = useState(false)
  const [hiddenBy, setHiddenBy] = useState<Record<string, { hidden: number; failed: number }>>({})
  const keyRef = useRef<CryptoKey | null>(null)
  const vaultRef = useRef<VaultDoc | null>(null)
  const rawRef = useRef<Partial<Record<CollectionName, Row[]>>>({})
  const seqRef = useRef<Record<string, number>>({})

  /** Puts a collection's rows into the data, opening encrypted ones when the key is available. */
  const ingest = useCallback(async (name: CollectionName, rows: Row[]) => {
    if (!PROTECTED_SET.has(name)) {
      setData((prev) => ({ ...prev, [name]: sortData(name, rows), ...(name === "settings" ? { contacts: ((rows as { id: string }[]).find((r) => r.id === "contacts") ?? null) as BranchContacts | null } : {}) }))
      setLoaded((prev) => (prev[name] ? prev : { ...prev, [name]: true }))
      return
    }
    rawRef.current[name] = rows
    const seq = (seqRef.current[name] ?? 0) + 1
    seqRef.current[name] = seq
    const key = keyRef.current
    let hidden = 0
    let failed = 0
    const opened = await Promise.all(
      rows.map(async (r) => {
        if (!isEncrypted(r)) return r
        if (!key) {
          hidden++
          return null
        }
        try {
          return (await decryptDoc(key, name, r.id, r.enc)) as Row
        } catch {
          failed++
          return null
        }
      }),
    )
    if (seqRef.current[name] !== seq) return
    setData((prev) => ({ ...prev, [name]: sortData(name, opened.filter(Boolean) as Row[]), ...(name === "settings" ? { contacts: ((opened.filter(Boolean) as { id: string }[]).find((r) => r.id === "contacts") ?? null) as BranchContacts | null } : {}) }))
    setHiddenBy((prev) => ({ ...prev, [name]: { hidden, failed } }))
    setLoaded((prev) => (prev[name] ? prev : { ...prev, [name]: true }))
  }, [])

  const reingest = useCallback(() => {
    for (const name of PROTECTED) {
      const rows = rawRef.current[name]
      if (rows) void ingest(name, rows)
    }
  }, [ingest])

  /**
   * Visitors who are not signed in to Claude get no database at all, so the
   * page falls back to the public copy published next to it (public-data.json):
   * the open collections as stored, the protected ones still encrypted, and the
   * password-wrapped key, so the password alone opens «الأداء والتطوير».
   */
  const loadSnapshot = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`public-data.json?t=${Date.now()}`, { cache: "no-store" })
      if (!res.ok) return false
      const snap = (await res.json()) as { generatedAt?: string; vault?: VaultDoc | null; collections?: Partial<Record<CollectionName, Row[]>> }
      if (!snap || typeof snap !== "object" || !snap.collections) return false
      const v = snap.vault && snap.vault.v === 1 && snap.vault.wrapped ? snap.vault : null
      vaultRef.current = v
      setVaultDoc(v)
      setVaultLoaded(true)
      await Promise.all(COLLECTIONS.map((c) => ingest(c, (snap.collections?.[c] ?? []) as Row[])))
      setSnapshotAt(snap.generatedAt ?? null)
      setLastSync(snap.generatedAt ? new Date(snap.generatedAt) : new Date())
      setConnection({ kind: "ready" })
      return true
    } catch {
      return false
    }
  }, [ingest])

  useEffect(() => {
    let cancelled = false
    const unsubs: Unsub[] = []
    setConnection({ kind: "connecting" })
    setLoaded(NONE_LOADED)
    ;(async () => {
      const rt = await waitForRuntime()
      if (cancelled) return
      if (!rt) {
        if (await loadSnapshot()) return
        if (!cancelled) setConnection({ kind: "unavailable", reason: "تُعرض المنصة خارج Claude، فلا يمكنها الوصول إلى قاعدة بياناتها." })
        return
      }
      const [db, user] = await Promise.all([
        rt.use("db").catch(() => null) as Promise<Db | null>,
        rt.use("user").catch(() => null) as Promise<UserNs | null>,
      ])
      if (cancelled) return
      const supabaseMode = (rt as { kind?: string }).kind === "supabase" && !!db
      setMemberMode(supabaseMode)
      userRef.current = user
      user?.canEdit().then((v) => !cancelled && setCanEdit(Boolean(v))).catch(() => {})
      user?.isOwner?.().then((v) => !cancelled && setIsOwner(Boolean(v))).catch(() => {})
      if (supabaseMode) {
        user?.me?.()
          .then((info) => !cancelled && setMemberInfo({ checked: true, info }))
          .catch(() => !cancelled && setMemberInfo({ checked: true, info: null }))
        // what the database lets this person read changes with who is signed in: reload everything
        unsubs.push(onSignInChange(() => setEpoch((e) => e + 1)))
      }
      if (!db) {
        if (await loadSnapshot()) return
        if (!cancelled)
          setConnection({
            kind: "unavailable",
            reason: "تعذّر تحميل بيانات المنصة. أعد تحميل الصفحة بعد قليل.",
          })
        return
      }
      setSnapshotAt(null)
      dbRef.current = db
      // The vault: the password-locked data key (readable by all) and, for the
      // owner only, the one-time setup key.
      unsubs.push(
        db
          .collection("vault")
          .limit(10)
          .onSnapshot(
            (snap) => {
              if (cancelled) return
              const d = snap.docs.find((x) => x.id === "main")?.data() as VaultDoc | undefined
              const v = d && d.v === 1 && d.wrapped ? d : null
              vaultRef.current = v
              setVaultDoc(v)
              setVaultLoaded(true)
            },
            () => !cancelled && setVaultLoaded(true),
          ),
      )
      unsubs.push(
        db
          .collection("vaultSetup")
          .limit(10)
          .onSnapshot(
            (snap) => {
              if (cancelled) return
              const d = snap.docs.find((x) => x.id === "key")?.data() as { key?: string; keyId?: string } | undefined
              setSetupKey(d?.key && d.keyId ? { key: d.key, keyId: d.keyId } : null)
            },
            () => {},
          ),
      )
      for (const name of COLLECTIONS) {
        const un = db
          .collection(name)
          .limit(1000)
          .onSnapshot(
            (snap) => {
              if (cancelled) return
              const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() ?? {}) }))
              void ingest(name, rows)
              setLastSync(new Date())
              setConnection((c) => (c.kind === "ready" ? c : { kind: "ready" }))
            },
            (e) => {
              if (cancelled) return
              setConnection({ kind: "error", code: e.code, message: errText(e) })
              if (!failedOnce.current) {
                failedOnce.current = true
                toast.error("فشلت مزامنة البيانات", { description: errText(e) })
              }
            },
          )
        unsubs.push(un)
      }
    })()
    return () => {
      cancelled = true
      unsubs.forEach((u) => u())
    }
  }, [epoch, ingest, loadSnapshot])

  const reconnect = useCallback(() => {
    failedOnce.current = false
    setEpoch((e) => e + 1)
  }, [])

  const refresh = useCallback(async () => {
    const db = dbRef.current
    if (!db) {
      const ok = await loadSnapshot()
      if (ok) toast.success("تم تحديث البيانات", { description: "المعروض هو آخر نسخة عامة منشورة." })
      else toast.error("تعذّر التحديث", { description: "تعذّر تحميل النسخة العامة من البيانات." })
      return
    }
    const id = toast.loading("جارٍ تحديث البيانات…")
    try {
      const results = await Promise.all(COLLECTIONS.map((c) => db.collection(c).limit(1000).get()))
      await Promise.all(COLLECTIONS.map((c, i) => ingest(c, results[i].docs.map((d) => ({ id: d.id, ...(d.data() ?? {}) })))))
      setLastSync(new Date())
      setConnection({ kind: "ready" })
      toast.success("تم تحديث البيانات", { id, description: "المعروض الآن يطابق آخر نسخة في قاعدة المنصة." })
    } catch (e) {
      const err = e as DbError
      setConnection({ kind: "error", code: err?.code ?? "unknown", message: errText(err ?? { code: "", message: "" }) })
      toast.error("فشل تحديث البيانات", { id, description: errText(err ?? { code: "", message: "" }) })
    }
  }, [ingest, loadSnapshot])

  const write = useCallback(async (fn: (db: Db) => Promise<void>, ok: string): Promise<boolean> => {
    const db = dbRef.current
    if (!db) {
      toast.error("لم يُحفظ التعديل", { description: "قاعدة بيانات المنصة غير متصلة." })
      return false
    }
    try {
      await fn(db)
      toast.success(ok)
      return true
    } catch (e) {
      toast.error("لم يُحفظ التعديل", { description: errText(e as DbError) })
      return false
    }
  }, [])

  /** Writes a whole protected document, encrypted once the vault exists. */
  const putProtected = useCallback(async (db: Db, collection: CollectionName, id: string, doc: Record<string, unknown>) => {
    if (vaultRef.current) {
      const key = keyRef.current
      if (!key) throw { code: "locked", message: "locked" }
      await db.doc(`${collection}/${id}`).set(await encryptDoc(key, collection, id, doc))
    } else {
      await db.doc(`${collection}/${id}`).set(doc)
    }
  }, [])

  const saveBranchLinks = useCallback(
    async (slug: string, links: Record<IndicatorKey, string | null>) => {
      const b = data.branches.find((x) => x.slug === slug)
      if (!b) return false
      const next = {
        satisfaction: buildLink("satisfaction", links.satisfaction, b.links.satisfaction),
        communication: buildLink("communication", links.communication, b.links.communication),
      }
      const fileId = next.satisfaction.fileId || next.communication.fileId || b.fileId
      const fileUrl = fileId
        ? `https://docs.google.com/spreadsheets/d/${fileId}/edit?gid=1800019553#gid=1800019553`
        : b.fileUrl
      return write(
        (db) =>
          putProtected(db, "branches", slug, {
            ...(b as unknown as Record<string, unknown>),
            links: next,
            fileId: fileId ?? null,
            fileUrl: fileUrl ?? null,
            updatedAt: new Date().toISOString(),
          }),
        `حُفظت روابط فرع ${b.name}`,
      )
    },
    [data.branches, write, putProtected],
  )

  const saveFile = useCallback(
    (item: FileItem) =>
      write(
        (db) => db.doc(`files/${item.id}`).set({ ...item, updatedAt: new Date().toISOString() }),
        `حُفظ «${item.title}» في المكتبة`,
      ),
    [write],
  )

  const deleteFile = useCallback(
    (id: string) => write((db) => db.doc(`files/${id}`).delete(), "حُذف الملف من المكتبة"),
    [write],
  )

  const saveSettings = useCallback(
    (patch: Partial<Settings>) =>
      write(async (db) => {
        const cur = data.settings
        const next = { ...(cur ?? {}), ...patch, id: "main", updatedAt: new Date().toISOString() }
        await db.doc("settings/main").set(next as Record<string, unknown>)
      }, "حُفظت الإعدادات"),
    [data.settings, write],
  )

  const markAlert = useCallback(
    (id: string, signature: string, done: boolean) =>
      write(
        (db) =>
          done
            ? putProtected(db, "alertState", id, { signature, state: "done", at: new Date().toISOString() })
            : db.doc(`alertState/${id}`).delete(),
        done ? "سُجّل التنبيه كمُتابَع" : "أُعيد فتح التنبيه",
      ),
    [write, putProtected],
  )

  const saveSocialAccount = useCallback(
    (a: SocialAccount) =>
      write((db) => db.doc(`socialAccounts/${a.id}`).set({ ...a, updatedAt: new Date().toISOString() }), `حُفظ حساب «${a.name}»`),
    [write],
  )

  // Removing an account also removes its monthly readings, so no orphan numbers remain.
  const deleteSocialAccount = useCallback(
    (id: string) =>
      write(async (db) => {
        for (const r of data.socialReadings.filter((x) => x.account === id)) await db.doc(`socialReadings/${r.id}`).delete()
        await db.doc(`socialAccounts/${id}`).delete()
      }, "حُذف الحساب وقراءاته"),
    [data.socialReadings, write],
  )

  // One document per account and month; an emptied field deletes that month's reading.
  const saveSocialReadings = useCallback(
    (month: string, entries: { account: string; followers: number | null }[]) =>
      write(async (db) => {
        const now = new Date().toISOString()
        for (const e of entries) {
          const id = `${e.account}__${month}`
          const cur = data.socialReadings.find((r) => r.id === id)
          if (e.followers === null) {
            if (cur) await db.doc(`socialReadings/${id}`).delete()
          } else if (!cur || cur.followers !== e.followers) {
            await db.doc(`socialReadings/${id}`).set({ id, account: e.account, month, followers: e.followers, recordedAt: now })
          }
        }
      }, "حُفظت أرقام الشهر"),
    [data.socialReadings, write],
  )

  // Classifies several library items at once (only the section changes).
  const saveFileSections = useCallback(
    (ids: string[], section: FileItem["section"]) =>
      write(async (db) => {
        const now = new Date().toISOString()
        for (const id of ids) {
          const f = data.files.find((x) => x.id === id)
          if (f && (f.section ?? null) !== (section ?? null)) await db.doc(`files/${id}`).set({ ...f, section: section ?? null, updatedAt: now })
        }
      }, ids.length === 1 ? "حُفظ تصنيف الملف" : `حُفظ تصنيف ${ids.length} عناصر`),
    [data.files, write],
  )

  /* ---------------------------------------------------------------- communication journey */
  const saveEvent = useCallback(
    (ev: CalendarEvent) =>
      write(async (db) => {
        const now = new Date().toISOString()
        const { id, ...body } = ev
        await db.doc(`events/${id}`).set({ ...body, createdAt: ev.createdAt ?? now, updatedAt: now })
      }, `حُفظ «${ev.title}» في رحلة التواصل`),
    [write],
  )
  const deleteEvent = useCallback((id: string) => write((db) => db.doc(`events/${id}`).delete(), "حُذف الحدث من رحلة التواصل"), [write])

  const saveComplaintReports = useCallback(
    (items: { report: ComplaintReport; file: { name: string; type: string; b64: string } }[]) =>
      write(async (db) => {
        for (const { report, file } of items) {
          const { id, ...body } = report
          await db.doc(`complaintFiles/${id}`).set({ name: file.name, type: file.type, b64: file.b64 })
          await putProtected(db, "complaintReports", id, body as Record<string, unknown>)
        }
      }, items.length === 1 ? "حُفظ تقرير الشكاوى" : `حُفظت ${items.length} تقارير شكاوى`),
    [write, putProtected],
  )
  const saveCsrInitiative = useCallback(
    (i: CsrInitiative, ok?: string) =>
      write(async (db) => {
        const { id, ...body } = i
        await putProtected(db, "csrInitiatives", id, { ...body, updatedAt: new Date().toISOString() } as Record<string, unknown>)
      }, ok ?? `حُفظت مبادرة «${i.name}»`),
    [write, putProtected],
  )
  const deleteCsrInitiative = useCallback((id: string) => write((db) => db.doc(`csrInitiatives/${id}`).delete(), "حُذفت المبادرة"), [write])
  const saveCsrPartner = useCallback(
    (p: CsrPartner, ok?: string) =>
      write(async (db) => {
        const { id, ...body } = p
        await putProtected(db, "csrPartners", id, { ...body, updatedAt: new Date().toISOString() } as Record<string, unknown>)
      }, ok ?? `حُفظت شراكة «${p.name}»`),
    [write, putProtected],
  )
  const deleteCsrPartner = useCallback((id: string) => write((db) => db.doc(`csrPartners/${id}`).delete(), "حُذفت الشراكة"), [write])
  const savePbxReport = useCallback(
    (r: PbxReport) =>
      write(async (db) => {
        const { id, ...body } = r
        await putProtected(db, "pbxReports", id, body as Record<string, unknown>)
      }, "حُفظ تقرير السنترال"),
    [write, putProtected],
  )
  const deletePbxReport = useCallback((id: string) => write((db) => db.doc(`pbxReports/${id}`).delete(), "حُذف تقرير السنترال"), [write])
  const savePbxOfficers = useCallback(
    (list: PbxOfficer[], removed: string[]) =>
      write(async (db) => {
        for (const o of list) {
          const { id, ...body } = o
          await putProtected(db, "pbxOfficers", id, body as Record<string, unknown>)
        }
        for (const id of removed) await db.doc(`pbxOfficers/${id}`).delete()
      }, "حُفظت قائمة المسؤولين والتحويلات"),
    [write, putProtected],
  )
  const deleteComplaintReport = useCallback(
    (id: string) =>
      write(async (db) => {
        await db.doc(`complaintReports/${id}`).delete()
        await db.doc(`complaintFiles/${id}`).delete()
      }, "حُذف تقرير الشكاوى"),
    [write],
  )

  /* ---------------------------------------------------------------- vault */
  const unlock = useCallback(
    async (password: string) => {
      const v = vaultRef.current
      if (!v) return false
      const raw = await unwrapKey(v, password)
      if (!raw) return false
      keyRef.current = await importDataKey(raw)
      setKeyOpen(true)
      reingest()
      return true
    },
    [reingest],
  )

  const lock = useCallback(() => {
    keyRef.current = null
    setKeyOpen(false)
    reingest()
  }, [reingest])

  const setup = useCallback(
    async (password: string) => {
      const db = dbRef.current
      if (!db || !setupKey) return false
      try {
        const raw = fromB64(setupKey.key)
        if ((await keyIdOf(raw)) !== setupKey.keyId) throw new Error("key id mismatch")
        const doc = await wrapKey(raw, password)
        await db.doc("vault/main").set(doc as unknown as Record<string, unknown>)
        vaultRef.current = doc
        setVaultDoc(doc)
        keyRef.current = await importDataKey(raw)
        setKeyOpen(true)
        reingest()
        // The plain setup key is no longer needed once the password locks it.
        await db.doc("vaultSetup/key").delete().catch(() => {})
        toast.success("ضُبطت كلمة المرور وفُتح قسم الأداء والتطوير")
        return true
      } catch (e) {
        toast.error("لم تُضبط كلمة المرور", { description: errText(e as DbError) })
        return false
      }
    },
    [setupKey, reingest],
  )

  const changePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<"ok" | "wrong" | "failed"> => {
    const db = dbRef.current
    const v = vaultRef.current
    if (!db || !v) return "failed"
    const raw = await unwrapKey(v, oldPassword)
    if (!raw) return "wrong"
    try {
      const doc = await wrapKey(raw, newPassword)
      await db.doc("vault/main").set(doc as unknown as Record<string, unknown>)
      vaultRef.current = doc
      setVaultDoc(doc)
      toast.success("تغيّرت كلمة المرور", { description: "أعطِ الكلمة الجديدة لمن يحتاجها، فالقديمة لم تعد تعمل." })
      return "ok"
    } catch (e) {
      toast.error("لم تتغيّر كلمة المرور", { description: errText(e as DbError) })
      return "failed"
    }
  }, [])

  const hiddenTotals = Object.values(hiddenBy).reduce((a, b) => ({ hidden: a.hidden + b.hidden, failed: a.failed + b.failed }), { hidden: 0, failed: 0 })
  const recheckMember = useCallback(() => {
    userRef.current?.me?.().then((info) => setMemberInfo({ checked: true, info })).catch(() => {})
  }, [])
  const member = useMemo<Member>(
    () => ({
      enabled: memberMode,
      checked: memberInfo.checked,
      role: memberInfo.info?.role ?? null,
      name: memberInfo.info?.name ?? null,
      mustChange: !!memberInfo.info?.must_change_password,
      recheck: recheckMember,
    }),
    [memberMode, memberInfo, recheckMember],
  )
  const memberLock = useCallback(() => void signOut(), [])

  const vault = useMemo<Vault>(
    () => ({
      // On the public site the members' sign-in replaces the shared password.
      status: memberMode
        ? !memberInfo.checked ? "loading" : memberInfo.info && !memberInfo.info.must_change_password ? "unlocked" : "locked"
        : !cryptoAvailable() ? "unsupported" : !vaultLoaded ? "loading" : !vaultDoc ? "none" : keyOpen ? "unlocked" : "locked",
      isOwner: memberMode ? memberInfo.info?.role === "owner" : isOwner,
      setupReady: !!setupKey,
      hidden: hiddenTotals.hidden,
      failed: hiddenTotals.failed,
      unlock,
      lock: memberMode ? memberLock : lock,
      setup,
      changePassword,
    }),
    [memberMode, memberInfo, memberLock, vaultLoaded, vaultDoc, keyOpen, isOwner, setupKey, hiddenTotals.hidden, hiddenTotals.failed, unlock, lock, setup, changePassword],
  )

  const allLoaded = COLLECTIONS.every((c) => loaded[c])

  const value = useMemo<Store>(
    () => ({
      connection,
      loaded,
      allLoaded,
      data,
      lastSync,
      canEdit: canEdit && !snapshotAt,
      snapshotAt,
      refresh,
      reconnect,
      saveBranchLinks,
      saveFile,
      deleteFile,
      saveSettings,
      markAlert,
      saveSocialAccount,
      deleteSocialAccount,
      saveSocialReadings,
      saveFileSections,
      saveEvent,
      deleteEvent,
      saveComplaintReports,
      deleteComplaintReport,
      saveCsrInitiative,
      deleteCsrInitiative,
      saveCsrPartner,
      deleteCsrPartner,
      savePbxReport,
      deletePbxReport,
      savePbxOfficers,
      vault,
      member,
    }),
    [connection, loaded, allLoaded, data, lastSync, canEdit, snapshotAt, refresh, reconnect, saveBranchLinks, saveFile, deleteFile, saveSettings, markAlert, saveSocialAccount, deleteSocialAccount, saveSocialReadings, saveFileSections, saveEvent, deleteEvent, saveComplaintReports, deleteComplaintReport, saveCsrInitiative, deleteCsrInitiative, saveCsrPartner, deleteCsrPartner, savePbxReport, deletePbxReport, savePbxOfficers, vault, member],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const v = useContext(Ctx)
  if (!v) throw new Error("useStore outside DataProvider")
  return v
}

/* ------------------------------------------------------------------ derived */
export function useDerived() {
  const { data } = useStore()
  return useMemo(() => {
    const indicatorByKey = new Map<string, IndicatorSummary>()
    data.indicators.forEach((i) => indicatorByKey.set(`${i.branch}__${i.indicator}`, i))
    const stagesByBranch = new Map<string, StageSummary[]>()
    data.stages.forEach((s) => {
      const list = stagesByBranch.get(s.branch) ?? []
      list.push(s)
      stagesByBranch.set(s.branch, list)
    })
    const branchBySlug = new Map(data.branches.map((b) => [b.slug, b]))
    return { indicatorByKey, stagesByBranch, branchBySlug }
  }, [data])
}

export type DataDepth = "full" | "partial" | "none"

export function branchDepth(slug: string, d: ReturnType<typeof useDerived>): DataDepth {
  const hasStages = (d.stagesByBranch.get(slug)?.length ?? 0) > 0
  const hasInd = d.indicatorByKey.has(`${slug}__satisfaction`) || d.indicatorByKey.has(`${slug}__communication`)
  if (hasStages) return "full"
  if (hasInd) return "partial"
  return "none"
}
