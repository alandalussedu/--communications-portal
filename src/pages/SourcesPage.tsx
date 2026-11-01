import { RemedialSourcesPanel } from "@/components/RemedialSourcesPanel"
import { Lock, PlugZap, RefreshCw } from "lucide-react"
import { useStore } from "@/data/store"
import type { CollectionName } from "@/data/types"
import { formatDate, formatNumber, formatTime } from "@/lib/format"
import { SyncStatus } from "@/components/Shell"
import { BranchLinksForm, StaleDaysForm } from "@/components/admin"
import { DEFAULT_STALE_DAYS } from "@/data/insights"
import { Banner, Dot, EmptyState, OpenLink, PageHeader, Panel, PanelHeader, Pill } from "@/components/common"

const COLLECTION_LABEL: Record<CollectionName, string> = {
  branches: "الفروع وروابطها",
  indicators: "الصفوف الرئيسية للمعاملات",
  stages: "سجلات المراحل",
  files: "ملفات المكتبة",
  meta: "بيانات المصادر",
  syncLog: "سجل المزامنة",
  settings: "إعدادات المنصة",
  alertState: "متابعة التنبيهات",
}
const RESULT = { success: ["نجحت", "ok"], partial: ["نجحت جزئيًا", "sky"], failed: ["فشلت", "bad"] } as const

export function SourcesPage() {
  const { data, loaded, connection, lastSync, refresh, reconnect, canEdit } = useStore()
  const counts: Record<CollectionName, number> = {
    branches: data.branches.length,
    indicators: data.indicators.length,
    stages: data.stages.length,
    files: data.files.length,
    meta: data.meta ? 1 : 0,
    syncLog: data.syncLog.length,
    settings: data.settings ? 1 : 0,
    alertState: data.alertState.length,
  }
  const branchName = (slug: string | null) => (slug ? data.branches.find((b) => b.slug === slug)?.name ?? slug : "كل الفروع")
  const srcTitle = (id: string) => data.meta?.sources.find((s) => s.id === id)?.title ?? id
  const live = data.meta?.liveSync

  return (
    <>
      <PageHeader
        eyebrow="المصادر"
        title="من أين تأتي البيانات"
        description="كل رقم في المنصة له مصدر في ملفات Google Sheets المعتمدة. هذه الصفحة تبيّن المصدر وتاريخ النقل وحالة الاتصال."
        actions={
          <button
            type="button"
            onClick={connection.kind === "error" ? reconnect : refresh}
            disabled={connection.kind === "connecting" || connection.kind === "unavailable"}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-[16px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {connection.kind === "error" ? "إعادة الاتصال" : "تحديث البيانات"}
          </button>
        }
      />

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="قاعدة بيانات المنصة" hint="تحفظ المنصة نسخة مما نُقل من الملفات، وتتابع أي تعديل عليها مباشرة." actions={<SyncStatus />} />
          {connection.kind === "unavailable" ? (
            <EmptyState compact title="غير متصلة في هذا العرض" body={connection.reason} />
          ) : (
            <>
              {connection.kind === "error" && (
                <div className="px-5 pt-4">
                  <Banner tone="bad" title="فشلت المزامنة">
                    {connection.message}
                  </Banner>
                </div>
              )}
              <ul className="divide-y">
                {(Object.keys(COLLECTION_LABEL) as CollectionName[]).map((c) => (
                  <li key={c} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[16px]">
                    <span className="flex items-center gap-2">
                      <Dot tone={loaded[c] ? (counts[c] ? "ok" : "warn") : "neutral"} />
                      {COLLECTION_LABEL[c]}
                    </span>
                    <span className="num text-muted-foreground">
                      {loaded[c] ? formatNumber(counts[c]) : "جارٍ التحميل…"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="border-t px-5 py-3 text-[14px] text-muted-foreground">
                {lastSync ? `آخر قراءة من القاعدة: ${formatTime(lastSync)} اليوم` : "لم تكتمل أول قراءة بعد."}
              </p>
            </>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="المزامنة مع Google Sheets"
            hint="قراءة ملفات الفروع تلقائيًا دون نقل يدوي."
            actions={live?.enabled ? <Pill tone="ok">مفعّلة</Pill> : <Pill tone="warn">غير مفعّلة</Pill>}
          />
          <div className="space-y-4 px-5 py-4 text-[16px]">
            <p className="text-muted-foreground">{live?.reason ?? "لم تُسجّل حالة المزامنة بعد."}</p>
            {!live?.enabled && (
              <div className="rounded-lg bg-muted/70 p-4">
                <p className="flex items-center gap-2 font-medium">
                  <PlugZap className="h-4 w-4 text-sky-ink" aria-hidden="true" />
                  ما يلزم لتفعيلها
                </p>
                <ol className="mt-2 list-decimal space-y-1 ps-5 text-[15px] text-muted-foreground">
                  <li className={live?.lastRun ? "line-through decoration-ok/60" : ""}>ربط موصل Google Sheets بحساب له صلاحية عرض على ملفات الفروع.{live?.lastRun ? " ✓ تم" : ""}</li>
                  <li>جدولة قراءة دورية للصف الرئيسي لكل معامل وقيم المراحل، دون أي تعديل على الملفات.</li>
                  <li>عرض نتيجة كل قراءة في سجل المزامنة أدناه: نجحت أو فشلت ولماذا، لكل فرع.</li>
                </ol>
                {live?.lastRun && <p className="mt-2 text-[14px] text-ok">آخر قراءة مباشرة: {formatDate(live.lastRun)}</p>}
              </div>
            )}
            {live?.lastError && <Banner tone="bad" title="آخر محاولة مزامنة فشلت">{live.lastError}</Banner>}
          </div>
        </Panel>
      </div>

      <Panel className="mt-4">
        <PanelHeader title="مصادر البيانات" hint={data.meta ? `نُقلت بتاريخ ${formatDate(data.meta.capturedAt)}` : undefined} />
        {data.meta?.sources.length ? (
          <ul className="divide-y">
            {data.meta.sources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-[15px] text-muted-foreground">
                    {s.method} · {formatDate(s.capturedAt)}
                  </p>
                </div>
                <OpenLink href={s.url} size="sm">{s.url ? "فتح المصدر" : "لا رابط"}</OpenLink>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact title="لا مصادر مسجلة" body="تظهر هنا الملفات التي نُقلت منها البيانات." />
        )}
      </Panel>

      <Panel className="mt-4">
        <PanelHeader title="سجل المزامنة" hint="كل محاولة قراءة لمصدر: وقت المحاولة، ووقت النجاح إن نجحت، والنتيجة." />
        {data.syncLog.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <caption className="sr-only">سجل المزامنة</caption>
              <thead>
                <tr className="border-b bg-muted/60 text-[14px] text-muted-foreground">
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">المصدر</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">النطاق</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">المحاولة</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">النجاح</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">النتيجة</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-medium">ملاحظة</th>
                </tr>
              </thead>
              <tbody>
                {data.syncLog.map((e) => (
                  <tr key={e.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{srcTitle(e.source)}</div>
                      <div className="text-[14px] text-muted-foreground">{e.method}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{branchName(e.branch)}</td>
                    <td className="num whitespace-nowrap px-4 py-3">{formatDate(e.attemptedAt)}</td>
                    <td className="num whitespace-nowrap px-4 py-3">{e.succeededAt ? formatDate(e.succeededAt) : "—"}</td>
                    <td className="px-4 py-3"><Pill tone={RESULT[e.result][1]}>{RESULT[e.result][0]}</Pill></td>
                    <td className="px-4 py-3 text-[14px] text-muted-foreground">{e.message ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState compact title="لا قراءات مسجلة" body="يظهر هنا كل نقل أو مزامنة للبيانات." />
        )}
        <p className="border-t px-5 py-3 text-[14px] text-muted-foreground">
          الفروع التي لا تظهر هنا لم تُقرأ بياناتها بعد، وتظهر في المنصة بحالة «بانتظار الربط».
        </p>
      </Panel>

      <RemedialSourcesPanel />

      <Panel className="mt-4">
        <PanelHeader
          title="مدة التحديث المحددة"
          hint={`يظهر تنبيه «تجاوز مدة التحديث» عندما يمضي على آخر قراءة ناجحة لفرع أكثر من ${formatNumber(data.settings?.staleDays ?? DEFAULT_STALE_DAYS)} يومًا.`}
          actions={!canEdit && <Pill><Lock className="h-3 w-3" aria-hidden="true" />للمحررين فقط</Pill>}
        />
        <div className="px-5 py-4">
          {canEdit ? <StaleDaysForm /> : <p className="text-[16px] text-muted-foreground">تغيير المدة متاح لمحرري المنصة فقط.</p>}
        </div>
      </Panel>

      <Panel className="mt-4">
        <PanelHeader
          title="تحديث روابط الفروع"
          hint="الصق الرابط المباشر لكل معامل من ملف المنصة الشاملة للفرع."
          actions={!canEdit && <Pill><Lock className="h-3 w-3" aria-hidden="true" />للمحررين فقط</Pill>}
        />
        <div className="px-5 py-4">
          {canEdit ? (
            data.branches.length ? <BranchLinksForm /> : <p className="text-[16px] text-muted-foreground">لا فروع مسجلة بعد.</p>
          ) : (
            <p className="text-[16px] text-muted-foreground">
              تعديل الروابط متاح لمحرري المنصة فقط. إن وجدت رابطًا ناقصًا أو خاطئًا فأبلغ إدارة التواصل المؤسسي.
            </p>
          )}
        </div>
      </Panel>
    </>
  )
}
