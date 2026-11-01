import { ArrowLeft } from "lucide-react"
import { useStore } from "@/data/store"
import { useRouter } from "@/lib/router"
import { usePersistent } from "@/lib/persist"
import { formatDate, formatTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { OpenLink, Panel, PanelHeader } from "./common"

/** The remedial-plan files as data sources, listed on the Sources page. */
export function RemedialSourcesPanel() {
  const { data } = useStore()
  const { go } = useRouter()
  const [, setTab] = usePersistent("rem-tab", "overview")
  const files = [...data.remedialFiles].sort((a, b) => (a.isRegister ? -1 : b.isRegister ? 1 : (a.label ?? "").localeCompare(b.label ?? "", "ar")))
  return (
    <Panel className="mt-4">
      <PanelHeader
        title="ملفات الخطط العلاجية"
        hint="سجل الروابط وملف كل فرع. تُقرأ عبر جلسة Claude بموصل Google Sheets، قراءة فقط."
        actions={
          <button
            type="button"
            onClick={() => {
              setTab("sources")
              go({ page: "remedial" })
            }}
            className="inline-flex items-center gap-1.5 text-[15px] font-bold text-primary hover:underline"
          >
            التفاصيل والتبويبات
            <ArrowLeft className="h-4 w-4" />
          </button>
        }
      />
      {files.length === 0 ? (
        <p className="px-5 py-4 text-[15px] text-muted-foreground">لم يُقرأ أي ملف خطة بعد.</p>
      ) : (
        <ul className="divide-y">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium">{f.isRegister ? f.label : `${data.branches.find((b) => b.slug === f.branch)?.name ?? ""}${f.label ? ` · ${f.label}` : ""}`}</p>
                <p className={cn("num text-[13px]", f.readStatus === "success" ? "text-muted-foreground" : "text-bad")}>
                  {f.readStatus === "success" ? `قُرئ ${formatDate(f.readAt)} · ${formatTime(new Date(f.readAt!))}` : f.readStatus === "failed" ? "فشلت القراءة" : "لم يُقرأ بعد"}
                </p>
              </div>
              <OpenLink href={f.url} size="sm">فتح</OpenLink>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
