import { useEffect, useState, type FormEvent } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { useStore } from "@/data/store"
import { INDICATORS, buildLink, isDriveUrl, isSheetUrl } from "@/data/links"
import { FILE_STATUSES, LIBRARY_SECTIONS, type FileItem, type FileStatus, type IndicatorKey, type LibrarySection } from "@/data/types"
import { DEFAULT_STALE_DAYS } from "@/data/insights"
import { Banner, SelectField } from "./common"

const inputCls =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"

function Label({ htmlFor, children, hint }: { htmlFor: string; children: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[15px] font-medium">
      {children}
      {hint && <span className="ms-1 font-normal text-muted-foreground">{hint}</span>}
    </label>
  )
}

function ErrorText({ id, text }: { id: string; text?: string | null }) {
  if (!text) return null
  return (
    <p id={id} className="mt-1 text-[15px] text-bad">
      {text}
    </p>
  )
}

/* ------------------------------------------------------------ branch links */
export function BranchLinksForm() {
  const { data, saveBranchLinks } = useStore()
  const [slug, setSlug] = useState(data.branches[0]?.slug ?? "")
  const b = data.branches.find((x) => x.slug === slug)
  const [vals, setVals] = useState<Record<IndicatorKey, string>>({ satisfaction: "", communication: "" })
  const [errors, setErrors] = useState<Partial<Record<IndicatorKey, string>>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!b) return
    setVals({ satisfaction: b.links.satisfaction?.recorded ?? "", communication: b.links.communication?.recorded ?? "" })
    setErrors({})
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!b) return null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Partial<Record<IndicatorKey, string>> = {}
    INDICATORS.forEach((i) => {
      const v = vals[i.key].trim()
      if (v && !isSheetUrl(v)) errs[i.key] = "الصق رابط ملف Google Sheets يبدأ بـ https://docs.google.com/spreadsheets/d/"
    })
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    await saveBranchLinks(slug, {
      satisfaction: vals.satisfaction.trim() || null,
      communication: vals.communication.trim() || null,
    })
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <SelectField
        id="admin-branch"
        label="الفرع"
        value={slug}
        onChange={setSlug}
        options={data.branches.map((x) => ({ value: x.slug, label: x.name }))}
      />
      {INDICATORS.map((i) => {
        const v = vals[i.key].trim()
        const preview = v && isSheetUrl(v) ? buildLink(i.key, v, b.links[i.key]).flag : null
        return (
          <div key={i.key}>
            <Label htmlFor={`admin-${i.key}`} hint="(اتركه فارغًا إن لم يتوفر)">{`رابط ${i.title}`}</Label>
            <input
              id={`admin-${i.key}`}
              dir="ltr"
              inputMode="url"
              value={vals[i.key]}
              onChange={(e) => {
                setVals((p) => ({ ...p, [i.key]: e.target.value }))
                setErrors((p) => ({ ...p, [i.key]: undefined }))
              }}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              aria-invalid={!!errors[i.key]}
              aria-describedby={errors[i.key] ? `err-${i.key}` : undefined}
              className={inputCls}
            />
            <ErrorText id={`err-${i.key}`} text={errors[i.key]} />
            {preview && <p className="mt-1 text-[14px] text-warn">{preview}</p>}
          </div>
        )
      })}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-[16px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          حفظ روابط {b.name}
        </button>
        <span className="text-[14px] text-muted-foreground">يُحدَّث رابط ملف الفرع تلقائيًا من الرابط الملصق.</span>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------ library file */
export function FileForm({ item, groups, onDone }: { item?: FileItem; groups: string[]; onDone: () => void }) {
  const { saveFile, deleteFile, data } = useStore()
  const NEW = "__new__"
  const [title, setTitle] = useState(item?.title ?? "")
  const [group, setGroup] = useState(item?.group ?? groups[0] ?? NEW)
  const [newGroup, setNewGroup] = useState("")
  const [url, setUrl] = useState(item?.url ?? "")
  const [fileLabel, setFileLabel] = useState(item?.fileLabel ?? "")
  const [description, setDescription] = useState(item?.description ?? "")
  const [keywords, setKeywords] = useState((item?.keywords ?? []).join("، "))
  const [status, setStatus] = useState<string>(item?.status ?? "")
  const [version, setVersion] = useState(item?.version ?? "")
  const [owner, setOwner] = useState(item?.owner ?? "")
  const [docDate, setDocDate] = useState(item?.docDate ?? "")
  const [section, setSection] = useState<string>(item?.section ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const u = url.trim()
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = "اكتب اسم الملف كما يعرفه الموظفون."
    if (group === NEW && !newGroup.trim()) errs.group = "اكتب اسم المجموعة الجديدة."
    if (u && !isDriveUrl(u)) errs.url = "الصق رابطًا من Google Drive أو Google Docs يبدأ بـ https://drive.google.com أو https://docs.google.com"
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    const ok = await saveFile({
      id: item?.id ?? `f-${Date.now().toString(36)}`,
      title: title.trim(),
      group: group === NEW ? newGroup.trim() : group,
      kind: !u ? "doc" : /\/drive\/folders\//.test(u) ? "folder" : "file",
      url: u || null,
      fileLabel: u ? null : fileLabel.trim() || null,
      named: true,
      order: item?.order ?? Math.max(0, ...data.files.map((f) => f.order)) + 1,
      source: item?.source ?? "manual-entry",
      capturedAt: item?.capturedAt ?? new Date().toISOString().slice(0, 10),
      description: description.trim() || null,
      keywords: keywords
        .split(/[،,\n]/)
        .map((k) => k.trim())
        .filter(Boolean),
      status: (status || null) as FileStatus | null,
      version: version.trim() || null,
      owner: owner.trim() || null,
      docDate: docDate || null,
      section: (section || null) as LibrarySection | null,
    })
    setBusy(false)
    if (ok) onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="file-title">اسم الملف</Label>
        <input id="file-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="دليل الهوية البصرية 2026" aria-invalid={!!errors.title} aria-describedby={errors.title ? "err-file-title" : undefined} />
        <ErrorText id="err-file-title" text={errors.title} />
      </div>
      <SelectField
        id="file-section"
        label="القسم في المكتبة"
        value={section}
        onChange={setSection}
        options={[{ value: "", label: "غير مصنّف" }, ...LIBRARY_SECTIONS.map((x) => ({ value: x.key, label: x.label }))]}
      />
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <SelectField id="file-group" label="المجموعة" value={group} onChange={setGroup} options={[...groups.map((g) => ({ value: g, label: g })), { value: NEW, label: "مجموعة جديدة…" }]} />
        {group === NEW && (
          <div>
            <Label htmlFor="file-newgroup">اسم المجموعة</Label>
            <input id="file-newgroup" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} className={inputCls} aria-invalid={!!errors.group} />
            <ErrorText id="err-file-group" text={errors.group} />
          </div>
        )}
      </div>
      <div>
        <Label htmlFor="file-url" hint="(اتركه فارغًا إن لم يتوفر بعد)">الرابط</Label>
        <input id="file-url" dir="ltr" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} placeholder="https://drive.google.com/…" aria-invalid={!!errors.url} aria-describedby={errors.url ? "err-file-url" : undefined} />
        <ErrorText id="err-file-url" text={errors.url} />
      </div>
      {!url.trim() && (
        <div>
          <Label htmlFor="file-label" hint="(يظهر حتى يتوفر الرابط)">اسم الملف في السجل</Label>
          <input id="file-label" value={fileLabel} onChange={(e) => setFileLabel(e.target.value)} className={inputCls} />
        </div>
      )}
      <div>
        <Label htmlFor="file-desc" hint="(اختياري)">وصف مختصر</Label>
        <textarea id="file-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls + " h-auto py-2"} />
      </div>
      <div>
        <Label htmlFor="file-kw" hint="(افصل بينها بفاصلة)">كلمات مفتاحية وأسماء بديلة</Label>
        <input id="file-kw" value={keywords} onChange={(e) => setKeywords(e.target.value)} className={inputCls} placeholder="شعار، لوقو، الهوية" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          id="file-status"
          label="حالة الاعتماد"
          value={status}
          onChange={setStatus}
          options={[{ value: "", label: "غير مسجّلة" }, ...FILE_STATUSES.map((x) => ({ value: x, label: x }))]}
        />
        <div>
          <Label htmlFor="file-version" hint="(إن وجد)">رقم الإصدار</Label>
          <input id="file-version" value={version} onChange={(e) => setVersion(e.target.value)} className={inputCls} dir="ltr" />
        </div>
        <div>
          <Label htmlFor="file-owner" hint="(إن وجدت)">الجهة المالكة</Label>
          <input id="file-owner" value={owner} onChange={(e) => setOwner(e.target.value)} className={inputCls} />
        </div>
        <div>
          <Label htmlFor="file-date" hint="(كما في الملف)">تاريخ آخر تحديث</Label>
          <input id="file-date" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} className={inputCls} dir="ltr" />
        </div>
      </div>
      <p className="text-[14px] text-muted-foreground">لا تختر «معتمد» إلا إذا كان الملف معتمدًا فعلًا؛ المنصة لا تستنتج الاعتماد من التاريخ.</p>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[16px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {item ? "حفظ التعديلات" : "إضافة إلى المكتبة"}
          </button>
          <button type="button" onClick={onDone} className="h-11 rounded-full border px-5 text-[16px] hover:bg-accent">
            إلغاء
          </button>
        </div>
        {item && !confirmDelete && (
          <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[16px] text-bad hover:bg-bad-soft">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            حذف
          </button>
        )}
      </div>
      {item && confirmDelete && (
        <Banner
          tone="bad"
          title={`حذف «${item.title}» من المكتبة؟`}
          action={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  setBusy(true)
                  const ok = await deleteFile(item.id)
                  setBusy(false)
                  if (ok) onDone()
                }}
                className="h-9 rounded-md bg-bad px-3 text-[15px] font-bold text-primary-foreground"
              >
                احذف
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-9 rounded-md bg-card px-3 text-[15px] text-foreground">
                تراجع
              </button>
            </div>
          }
        >
          يُحذف من المنصة فقط. الملف نفسه يبقى في Google Drive.
        </Banner>
      )}
    </form>
  )
}

/* ------------------------------------------------------------ synonyms */
export function SynonymsForm({ onDone }: { onDone: () => void }) {
  const { data, saveSettings } = useStore()
  const [text, setText] = useState((data.settings?.synonyms ?? []).map((g) => g.join("، ")).join("\n"))
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const groups = text
      .split("\n")
      .map((l) => l.split(/[،,]/).map((w) => w.trim()).filter(Boolean))
      .filter((g) => g.length >= 2)
    setBusy(true)
    const ok = await saveSettings({ synonyms: groups })
    setBusy(false)
    if (ok) onDone()
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="syn-text">مجموعات المرادفات</Label>
        <textarea id="syn-text" value={text} onChange={(e) => setText(e.target.value)} rows={12} className={inputCls + " h-auto py-2 leading-relaxed"} placeholder={"شعار، لوقو، لوجو\nسوشال، تواصل اجتماعي"} />
        <p className="mt-1 text-[14px] text-muted-foreground">سطر لكل مجموعة، وكلمتان على الأقل في السطر.</p>
      </div>
      <div className="flex gap-2 border-t pt-4">
        <button type="submit" disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[16px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          حفظ المرادفات
        </button>
        <button type="button" onClick={onDone} className="h-11 rounded-full border px-5 text-[16px] hover:bg-accent">
          إلغاء
        </button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------ update window */
export function StaleDaysForm() {
  const { data, saveSettings } = useStore()
  const [days, setDays] = useState(String(data.settings?.staleDays ?? DEFAULT_STALE_DAYS))
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const n = Number(days)
    if (!Number.isInteger(n) || n < 1 || n > 365) {
      setErr("اكتب عدد أيام صحيحًا بين 1 و365.")
      return
    }
    setErr(null)
    setBusy(true)
    await saveSettings({ staleDays: n })
    setBusy(false)
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3" noValidate>
      <div>
        <Label htmlFor="stale-days">مدة التحديث المحددة (أيام)</Label>
        <input id="stale-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className={inputCls + " w-32"} dir="ltr" aria-invalid={!!err} aria-describedby={err ? "err-stale" : undefined} />
      </div>
      <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-[16px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        حفظ
      </button>
      <ErrorText id="err-stale" text={err} />
    </form>
  )
}
