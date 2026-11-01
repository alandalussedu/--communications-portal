import { useMemo, useState } from "react"
import { ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react"
import { useStore } from "@/data/store"
import { ALERT_KIND_LABEL, isHandled, type Alert, type AlertKind } from "@/data/insights"
import { useRouter, type Route } from "@/lib/router"
import { formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ChipGroup, Dot, EmptyState, Pill, type Tone } from "./common"

const SEV_TONE: Record<Alert["severity"], Tone> = { high: "bad", medium: "warn", low: "neutral" }
const SEV_LABEL: Record<Alert["severity"], string> = { high: "عالية", medium: "متوسطة", low: "منخفضة" }

type StateFilter = "open" | "done" | "all"

/** The alert list used on the command center and inside a branch profile. */
export function AlertList({ alerts, limit, compact = false }: { alerts: Alert[]; limit?: number; compact?: boolean }) {
  const { data, canEdit, markAlert } = useStore()
  const { go } = useRouter()
  const [state, setState] = useState<StateFilter>("open")
  const [kind, setKind] = useState<"all" | AlertKind>("all")
  const [expanded, setExpanded] = useState(false)

  const withState = useMemo(() => alerts.map((a) => ({ a, done: isHandled(a, data.alertState) })), [alerts, data.alertState])
  const kinds = Array.from(new Set(alerts.map((a) => a.kind)))
  const visible = withState.filter(
    ({ a, done }) => (state === "all" || (state === "done" ? done : !done)) && (kind === "all" || a.kind === kind),
  )
  const shown = limit && !expanded ? visible.slice(0, limit) : visible
  const openCount = withState.filter((x) => !x.done).length

  return (
    <div>
      {!compact && (
        <div className="flex flex-col gap-2 border-b px-5 py-3">
          <ChipGroup<StateFilter>
            label="الحالة"
            value={state}
            onChange={setState}
            options={[
              { value: "open", label: "مفتوحة", count: openCount },
              { value: "done", label: "تمت متابعتها", count: withState.length - openCount },
              { value: "all", label: "الكل", count: withState.length },
            ]}
          />
          {kinds.length > 1 && (
            <ChipGroup<"all" | AlertKind>
              label="النوع"
              value={kind}
              onChange={setKind}
              options={[
                { value: "all", label: "الكل" },
                ...kinds.map((k) => ({ value: k, label: ALERT_KIND_LABEL[k], count: alerts.filter((a) => a.kind === k).length })),
              ]}
            />
          )}
        </div>
      )}
      {shown.length === 0 ? (
        <EmptyState
          compact
          title={state === "open" ? "لا تنبيهات مفتوحة" : "لا تنبيهات تطابق الاختيار"}
          body={state === "open" && alerts.length ? "كل التنبيهات الحالية سُجّلت كمُتابَعة." : "تظهر هنا الحالات التي تحتاج انتباه الإدارة عند رصدها في البيانات."}
        />
      ) : (
        <ul className="divide-y">
          {shown.map(({ a, done }) => (
            <li key={a.id} className={cn("flex items-start gap-3 px-5 py-4", done && "opacity-70")}>
              <span className="mt-2.5">
                <Dot tone={done ? "ok" : SEV_TONE[a.severity]} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[17px] font-bold leading-snug">{a.title}</span>
                </div>
                <p className="mt-0.5 text-[15px] text-muted-foreground">{a.reason}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
                  <Pill tone={SEV_TONE[a.severity]}>أولوية {SEV_LABEL[a.severity]}</Pill>
                  <Pill>{ALERT_KIND_LABEL[a.kind]}</Pill>
                  {a.branch && <span>فرع {a.branch.name}</span>}
                  {a.detectedAt && <span className="num">رُصد: {formatDate(a.detectedAt)}</span>}
                  {done ? <Pill tone="ok">تمت المتابعة</Pill> : <Pill tone="warn">مفتوح</Pill>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <button
                  type="button"
                  onClick={() => go(a.route as Route)}
                  className="inline-flex h-9 items-center gap-1 rounded-md px-2.5 text-[15px] font-medium text-primary hover:bg-accent"
                >
                  فتح
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => markAlert(a.id, a.signature, !done)}
                    className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[14px] text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {done ? <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                    {done ? "إعادة فتح" : "تمت المتابعة"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {limit && visible.length > limit && (
        <div className="border-t px-5 py-3">
          <button type="button" onClick={() => setExpanded((e) => !e)} className="text-[15px] font-bold text-primary hover:underline">
            {expanded ? "عرض أقل" : `عرض كل التنبيهات (${formatNumber(visible.length)})`}
          </button>
        </div>
      )}
    </div>
  )
}
