import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock, ExternalLink, LayoutGrid, List, Loader2, MapPin, Pencil, Plus, Repeat, Trash2 } from "lucide-react"
import { useStore } from "@/data/store"
import { useRouter } from "@/lib/router"
import type { CalendarEvent, EventRepeat, EventType } from "@/data/types"
import { publicBranches } from "@/data/social"
import {
  EVENT_TYPES,
  REPEAT_LABEL,
  addDays,
  byDay,
  chipStyle,
  dayLabel,
  diffDays,
  dotStyle,
  expand,
  isYmd,
  monthGrid,
  monthName,
  monthOf,
  monthTitle,
  repeatLabel,
  schoolMonths,
  schoolYearOf,
  shiftMonthKey,
  shortDay,
  timeLabel,
  todayYmd,
  typeOf,
  weekday,
  whenLabel,
  WEEKDAYS,
  type Occurrence,
} from "@/data/calendar"
import { countLabel, formatNumber } from "@/lib/format"
import { usePersistent } from "@/lib/persist"
import { cn } from "@/lib/utils"
import { Gate } from "@/components/Gate"
import { Banner, EmptyState, PageHeader, Panel, SelectField } from "@/components/common"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

type Panel_ = { kind: "view"; occ: Occurrence } | { kind: "edit"; ev: CalendarEvent } | { kind: "new"; date: string } | null
type View = "month" | "list"

const eventsWord = (n: number) => countLabel(n, "حدث واحد", "حدثان", "أحداث", "حدثًا")

function useBranches() {
  const { data } = useStore()
  return useMemo(() => publicBranches(data), [data])
}
const branchLabel = (slug: string | null | undefined, branches: { slug: string; name: string }[]) => {
  if (!slug) return null
  const b = branches.find((x) => x.slug === slug)
  return b ? `فرع ${b.name}` : null
}

/* ================================================================== page */
export function CalendarPage() {
  const { data, canEdit } = useStore()
  const branches = useBranches()
  const today = todayYmd()
  const [month, setMonth] = usePersistent("cal-month", monthOf(today))
  const [view, setView] = usePersistent<View>("cal-view", typeof window !== "undefined" && window.innerWidth < 640 ? "list" : "month")
  const [type, setType] = usePersistent<"all" | EventType>("cal-type", "all")
  const [branch, setBranch] = usePersistent("cal-branch", "all")
  const [day, setDay] = useState<string | null>(monthOf(today) === month ? today : null)
  const [panel, setPanel] = useState<Panel_>(null)

  const sy = schoolYearOf(month)
  const months = schoolMonths(sy)
  const weeks = useMemo(() => monthGrid(month), [month])
  const filtered = useMemo(
    () => data.events.filter((e) => (type === "all" || e.type === type) && (branch === "all" || (branch === "none" ? !e.branch : e.branch === branch))),
    [data.events, type, branch],
  )
  const occ = useMemo(() => expand(filtered, weeks[0][0], weeks[weeks.length - 1][6]), [filtered, weeks])
  const days = useMemo(() => byDay(occ), [occ])
  const inMonth = occ.filter((o) => monthOf(o.start) === month || monthOf(o.end) === month || (o.start < `${month}-01` && o.end > `${month}-31`))
  // counts per month of the school year, for the month picker (filters applied)
  const perMonth = useMemo(() => {
    const all = expand(filtered, `${months[0]}-01`, `${months[months.length - 1]}-31`)
    const m = new Map<string, number>()
    all.forEach((o) => m.set(monthOf(o.start), (m.get(monthOf(o.start)) ?? 0) + 1))
    return m
  }, [filtered, months])
  const typeCounts = useMemo(() => {
    const m = new Map<string, number>()
    expand(data.events.filter((e) => branch === "all" || (branch === "none" ? !e.branch : e.branch === branch)), weeks[0][0], weeks[weeks.length - 1][6])
      .filter((o) => monthOf(o.start) === month)
      .forEach((o) => m.set(o.ev.type, (m.get(o.ev.type) ?? 0) + 1))
    return m
  }, [data.events, branch, weeks, month])

  const goMonth = (m: string) => {
    setMonth(m)
    setDay(monthOf(today) === m ? today : null)
  }
  const usedBranches = branches.filter((b) => data.events.some((e) => e.branch === b.slug))

  return (
    <>
      <PageHeader
        eyebrow={`العام الدراسي ${sy}-${sy + 1}`}
        title="رحلة التواصل"
        description="المواعيد والأحداث المهمة لإدارة التواصل المؤسسي والفروع على مدار العام الدراسي."
        actions={
          canEdit ? (
            <button type="button" onClick={() => setPanel({ kind: "new", date: day ?? (monthOf(today) === month ? today : `${month}-01`) })} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              إضافة حدث
            </button>
          ) : undefined
        }
      />
      <Gate needs={["events", "settings"]}>
        {/* month picker */}
        <section className="rise rounded-2xl border bg-card p-4 sm:p-5" aria-label="اختيار الشهر">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[16px] font-bold">اختر الشهر</h2>
            <div className="flex items-center gap-1 text-[14px] text-muted-foreground">
              <button type="button" onClick={() => goMonth(`${sy - 1}-09`)} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent" aria-label="العام الدراسي السابق">
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="num">
                {monthTitle(months[0])} - {monthTitle(months[months.length - 1])}
              </span>
              <button type="button" onClick={() => goMonth(`${sy + 1}-09`)} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent" aria-label="العام الدراسي التالي">
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
          <ul className="grid grid-cols-5 gap-2 lg:grid-cols-10">
            {months.map((m) => {
              const on = m === month
              const n = perMonth.get(m) ?? 0
              return (
                <li key={m}>
                  <button
                    type="button"
                    onClick={() => goMonth(m)}
                    aria-current={on ? "date" : undefined}
                    className={cn(
                      "relative flex w-full flex-col items-center rounded-xl border px-1 py-2 transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                    )}
                  >
                    <span className="text-[14px] font-bold sm:text-[15px]">{monthName(m)}</span>
                    <span className={cn("num text-[12px]", on ? "opacity-80" : "text-muted-foreground")}>{m.slice(0, 4)}</span>
                    {n > 0 && (
                      <span className={cn("num absolute -top-1.5 end-1 rounded-full px-1.5 text-[11px] font-bold leading-4", on ? "bg-gold text-primary" : "bg-secondary text-secondary-foreground")} aria-label={eventsWord(n)}>
                        {n}
                      </span>
                    )}
                    {monthOf(today) === m && !on && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-sky" aria-label="الشهر الحالي" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        {/* toolbar */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => goMonth(shiftMonthKey(month, -1))} className="inline-flex h-10 items-center gap-1 rounded-xl border bg-card px-3 text-[15px] font-medium hover:bg-accent">
            <ChevronRight className="h-4 w-4" />
            <span className="hidden sm:inline">الشهر السابق</span>
          </button>
          <div className="text-center">
            <h2 className="text-[20px] font-bold leading-tight" aria-live="polite">{monthTitle(month)}</h2>
            <p className="text-[13px] text-muted-foreground">{inMonth.length ? eventsWord(inMonth.length) : "لا أحداث"}</p>
          </div>
          <button type="button" onClick={() => goMonth(shiftMonthKey(month, 1))} className="inline-flex h-10 items-center gap-1 rounded-xl border bg-card px-3 text-[15px] font-medium hover:bg-accent">
            <span className="hidden sm:inline">الشهر التالي</span>
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* filters + legend + view */}
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="نوع الحدث">
            <TypeChip on={type === "all"} onClick={() => setType("all")} label="الكل" />
            {EVENT_TYPES.map((t) => (
              <TypeChip key={t.key} on={type === t.key} onClick={() => setType(type === t.key ? "all" : t.key)} label={t.label} dot={t.key} count={typeCounts.get(t.key)} />
            ))}
          </div>
          <div className="flex items-end gap-2">
            {(usedBranches.length > 0 || branch !== "all") && (
              <SelectField
                id="cal-branch"
                label="الفرع"
                value={branch}
                onChange={setBranch}
                options={[{ value: "all", label: "كل الفروع" }, { value: "none", label: "أحداث عامة" }, ...usedBranches.map((b) => ({ value: b.slug, label: b.name }))]}
              />
            )}
            <div className="inline-flex h-9 rounded-md border bg-card p-0.5" role="radiogroup" aria-label="طريقة العرض">
              {(
                [
                  ["month", "شهري", LayoutGrid],
                  ["list", "قائمة", List],
                ] as const
              ).map(([k, label, Icon]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={view === k}
                  onClick={() => setView(k)}
                  className={cn("inline-flex items-center gap-1.5 rounded px-2.5 text-[14px]", view === k ? "bg-primary font-bold text-primary-foreground" : "text-muted-foreground hover:bg-accent")}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {data.events.length === 0 && (
          <Panel className="mt-4">
            <EmptyState
              compact
              title="لم تُضف أحداث بعد"
              body={canEdit ? "أضف اللقاءات والمواعيد والمناسبات من زر «إضافة حدث»، أو اختر يومًا في التقويم ثم أضف حدثًا فيه." : "تظهر هنا المواعيد والأحداث بعد أن يضيفها محرر المنصة."}
            />
          </Panel>
        )}

        {view === "month" ? (
          <>
            <MonthGrid weeks={weeks} month={month} today={today} days={days} selected={day} onSelect={setDay} onOpen={(o) => setPanel({ kind: "view", occ: o })} />
            {day && <DayPanel day={day} occ={days.get(day) ?? []} canEdit={canEdit} onOpen={(o) => setPanel({ kind: "view", occ: o })} onAdd={() => setPanel({ kind: "new", date: day })} onClose={() => setDay(null)} />}
          </>
        ) : (
          <MonthList month={month} today={today} occ={inMonth} onOpen={(o) => setPanel({ kind: "view", occ: o })} />
        )}
      </Gate>

      <Sheet open={panel !== null} onOpenChange={(o) => !o && setPanel(null)}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-lg" dir="rtl">
          {panel?.kind === "view" ? (
            <EventDetail occ={panel.occ} canEdit={canEdit} onEdit={() => setPanel({ kind: "edit", ev: panel.occ.ev })} />
          ) : (
            <>
              <SheetHeader className="pe-8 text-start">
                <SheetTitle className="text-start text-[22px] font-bold">{panel?.kind === "edit" ? "تعديل الحدث" : "إضافة حدث"}</SheetTitle>
                <SheetDescription className="text-start text-[15px]">يظهر الحدث لكل من يفتح المنصة في تبويب رحلة التواصل.</SheetDescription>
              </SheetHeader>
              {panel && (panel.kind === "edit" || panel.kind === "new") && (
                <EventForm key={panel.kind === "edit" ? panel.ev.id : panel.date} item={panel.kind === "edit" ? panel.ev : undefined} date={panel.kind === "new" ? panel.date : undefined} onDone={() => setPanel(null)} />
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

function TypeChip({ on, onClick, label, dot, count }: { on: boolean; onClick: () => void; label: string; dot?: string; count?: number }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[14px] transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}
    >
      {dot && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={dotStyle(dot)} aria-hidden="true" />}
      {label}
      {!!count && <span className={cn("num text-[13px]", on ? "opacity-80" : "text-muted-foreground")}>{count}</span>}
    </button>
  )
}

/* ================================================================== month grid */
function MonthGrid({
  weeks,
  month,
  today,
  days,
  selected,
  onSelect,
  onOpen,
}: {
  weeks: string[][]
  month: string
  today: string
  days: Map<string, Occurrence[]>
  selected: string | null
  onSelect: (d: string) => void
  onOpen: (o: Occurrence) => void
}) {
  const MAX = 3
  return (
    <div className="rise mt-4 overflow-hidden rounded-2xl border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/50" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-1 py-2 text-center text-[12px] font-medium text-muted-foreground sm:text-[14px]">
            <span className="sm:hidden">{w.replace("ال", "").slice(0, 3)}</span>
            <span className="hidden sm:inline">{w}</span>
          </div>
        ))}
      </div>
      <div role="grid" aria-label={`تقويم ${monthTitle(month)}`}>
        {weeks.map((w) => (
          <div key={w[0]} role="row" className="grid grid-cols-7 border-b last:border-0">
            {w.map((d) => {
              const out = monthOf(d) !== month
              const list = out ? [] : days.get(d) ?? []
              const isToday = d === today
              const isSel = d === selected && !out
              return (
                <div
                  key={d}
                  role="gridcell"
                  aria-selected={isSel}
                  onClick={() => !out && onSelect(d)}
                  className={cn(
                    "cal-cell relative min-w-0 border-e p-1 last:border-e-0 sm:p-1.5",
                    out ? "bg-muted/30" : "cursor-pointer hover:bg-accent/40",
                    isSel && "bg-secondary/60 ring-2 ring-inset ring-primary",
                  )}
                >
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      disabled={out}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelect(d)
                      }}
                      aria-label={`${dayLabel(d)}${list.length ? ` · ${eventsWord(list.length)}` : ""}`}
                      className={cn(
                        "num inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[14px] font-bold sm:text-[15px]",
                        out && "font-normal text-muted-foreground/60",
                        isToday && "bg-primary text-primary-foreground",
                      )}
                    >
                      {Number(d.slice(8))}
                    </button>
                  </div>
                  {/* phones: colour dots only; the day panel lists the events */}
                  {list.length > 0 && (
                    <div className="mt-1 flex flex-wrap justify-center gap-0.5 sm:hidden" aria-hidden="true">
                      {list.slice(0, 4).map((o) => (
                        <span key={o.key} className="h-1.5 w-1.5 rounded-full" style={dotStyle(o.ev.type)} />
                      ))}
                    </div>
                  )}
                  <ul className="mt-1 hidden space-y-1 sm:block">
                    {list.slice(0, MAX).map((o) => (
                      <li key={o.key}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpen(o)
                          }}
                          className="block w-full rounded-md px-1.5 py-1 text-start text-[12px] font-bold leading-snug transition-opacity hover:opacity-80"
                          style={chipStyle(o.ev.type)}
                          title={o.ev.title}
                        >
                          <span className="line-clamp-2">
                            {o.ev.time && o.start === d && <span className="num font-medium opacity-80">{timeLabel(o.ev.time)} · </span>}
                            {o.ev.title}
                          </span>
                        </button>
                      </li>
                    ))}
                    {list.length > MAX && (
                      <li>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelect(d)
                          }}
                          className="px-1.5 text-[12px] font-bold text-primary hover:underline"
                        >
                          +{formatNumber(list.length - MAX)} أخرى
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function DayPanel({ day, occ, canEdit, onOpen, onAdd, onClose }: { day: string; occ: Occurrence[]; canEdit: boolean; onOpen: (o: Occurrence) => void; onAdd: () => void; onClose: () => void }) {
  return (
    <section className="rise mt-4 rounded-2xl border bg-card" aria-label={`أحداث ${dayLabel(day)}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h3 className="text-[17px] font-bold">{dayLabel(day)}</h3>
          <p className="text-[13px] text-muted-foreground">{occ.length ? eventsWord(occ.length) : "لا أحداث في هذا اليوم"}</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button type="button" onClick={onAdd} className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-medium hover:bg-accent">
              <Plus className="h-4 w-4" />
              حدث في هذا اليوم
            </button>
          )}
          <button type="button" onClick={onClose} className="h-9 rounded-full px-3 text-[14px] text-muted-foreground hover:bg-accent">
            إغلاق
          </button>
        </div>
      </div>
      {occ.length > 0 && (
        <ul className="divide-y">
          {occ.map((o) => (
            <li key={o.key}>
              <EventRow o={o} onOpen={() => onOpen(o)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function EventRow({ o, onOpen, showDate = false }: { o: Occurrence; onOpen: () => void; showDate?: boolean }) {
  const branches = useBranches()
  const t = typeOf(o.ev.type)
  const b = branchLabel(o.ev.branch, branches)
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 px-4 py-3 text-start hover:bg-accent/40">
      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={dotStyle(o.ev.type)} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold leading-snug">{o.ev.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
          <span className="font-medium" style={{ color: `hsl(var(${t.tone.ink}))` }}>{t.label}</span>
          {showDate && o.end > o.start && <span className="num">{`${shortDay(o.start)} - ${shortDay(o.end)}`}</span>}
          {o.ev.time && (
            <span className="num inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {timeLabel(o.ev.time)}
            </span>
          )}
          {b && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {b}
            </span>
          )}
          {o.ev.repeat && (
            <span className="inline-flex items-center gap-1">
              <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
              {REPEAT_LABEL[o.ev.repeat.every]}
            </span>
          )}
        </span>
      </span>
      <ChevronLeft className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  )
}

/* ================================================================== list */
function MonthList({ month, today, occ, onOpen }: { month: string; today: string; occ: Occurrence[]; onOpen: (o: Occurrence) => void }) {
  const first = `${month}-01`
  const groups = new Map<string, Occurrence[]>()
  occ.forEach((o) => {
    const d = o.start < first ? first : o.start
    groups.set(d, [...(groups.get(d) ?? []), o])
  })
  const keys = [...groups.keys()].sort()
  if (!keys.length)
    return (
      <Panel className="mt-4">
        <EmptyState compact title={`لا أحداث في ${monthTitle(month)}`} body="اختر شهرًا آخر، أو غيّر نوع الحدث أو الفرع." />
      </Panel>
    )
  return (
    <ol className="mt-4 space-y-3">
      {keys.map((d) => (
        <li key={d} className="rise flex gap-3">
          <div className={cn("flex w-16 shrink-0 flex-col items-center rounded-xl border py-2", d === today ? "border-primary bg-primary text-primary-foreground" : "bg-card", d < today && d !== today && "opacity-70")}>
            <span className="num text-[24px] font-extrabold leading-none">{Number(d.slice(8))}</span>
            <span className={cn("mt-1 text-[12px]", d === today ? "opacity-85" : "text-muted-foreground")}>{WEEKDAYS[weekday(d)]}</span>
          </div>
          <ul className={cn("min-w-0 flex-1 divide-y rounded-xl border bg-card", d < today && "opacity-80")}>
            {groups.get(d)!.map((o) => (
              <li key={o.key}>
                <EventRow o={o} onOpen={() => onOpen(o)} showDate />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}

/* ================================================================== detail */
function EventDetail({ occ, canEdit, onEdit }: { occ: Occurrence; canEdit: boolean; onEdit: () => void }) {
  const branches = useBranches()
  const ev = occ.ev
  const t = typeOf(ev.type)
  const b = branchLabel(ev.branch, branches)
  const rep = repeatLabel(ev.repeat)
  return (
    <div>
      <SheetHeader className="pe-8 text-start">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-bold" style={{ background: `hsl(var(${t.tone.soft}))`, color: `hsl(var(${t.tone.ink}))` }}>
          <span className="h-2 w-2 rounded-full" style={dotStyle(ev.type)} aria-hidden="true" />
          {t.label}
        </span>
        <SheetTitle className="text-start text-[24px] font-bold leading-snug">{ev.title}</SheetTitle>
        <SheetDescription className="sr-only">تفاصيل الحدث</SheetDescription>
      </SheetHeader>
      <dl className="mt-5 space-y-4">
        <DetailRow icon={CalendarDays} label="الموعد">
          {whenLabel(occ)}
          {occ.end > occ.start && <span className="block text-[14px] text-muted-foreground">{countLabel(diffDays(occ.start, occ.end) + 1, "يوم واحد", "يومان", "أيام", "يومًا")}</span>}
          {occ.end > occ.start && ev.time && <span className="num block text-[14px] text-muted-foreground">يبدأ {timeLabel(ev.time)}</span>}
        </DetailRow>
        {rep && <DetailRow icon={Repeat} label="التكرار">{rep}</DetailRow>}
        <DetailRow icon={MapPin} label="الجهة">{b ?? "حدث عام"}</DetailRow>
        {ev.notes && (
          <div>
            <dt className="text-[14px] text-muted-foreground">ملاحظات</dt>
            <dd className="mt-1 whitespace-pre-line text-[16px] leading-relaxed">{ev.notes}</dd>
          </div>
        )}
      </dl>
      <div className="mt-6 flex flex-wrap gap-2 border-t pt-4">
        {ev.link && (
          <a href={ev.link} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90">
            فتح الرابط
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        {canEdit && (
          <button type="button" onClick={onEdit} className="inline-flex h-11 items-center gap-2 rounded-full border px-5 text-[15px] hover:bg-accent">
            <Pencil className="h-4 w-4" />
            تعديل
          </button>
        )}
      </div>
    </div>
  )
}

function DetailRow({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-[14px] text-muted-foreground">{label}</dt>
        <dd className="text-[16px] font-medium">{children}</dd>
      </div>
    </div>
  )
}

/* ================================================================== form */
const inputCls = "h-10 w-full rounded-md border border-input bg-card px-3 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"

function L({ htmlFor, children, hint }: { htmlFor: string; children: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[15px] font-medium">
      {children}
      {hint && <span className="ms-1 font-normal text-muted-foreground">{hint}</span>}
    </label>
  )
}
function Err({ text }: { text?: string }) {
  return text ? <p className="mt-1 text-[14px] text-bad">{text}</p> : null
}

function EventForm({ item, date, onDone }: { item?: CalendarEvent; date?: string; onDone: () => void }) {
  const { saveEvent, deleteEvent } = useStore()
  const branches = useBranches()
  const [title, setTitle] = useState(item?.title ?? "")
  const [type, setType] = useState<string>(item?.type ?? "branch-meeting")
  const [start, setStart] = useState(item?.start ?? date ?? todayYmd())
  const [multi, setMulti] = useState(!!item?.end && item.end > item.start)
  const [end, setEnd] = useState(item?.end ?? "")
  const [time, setTime] = useState(item?.time ?? "")
  const [branch, setBranch] = useState(item?.branch ?? "")
  const [every, setEvery] = useState<string>(item?.repeat?.every ?? "")
  const [until, setUntil] = useState(item?.repeat?.until ?? "")
  const [link, setLink] = useState(item?.link ?? "")
  const [notes, setNotes] = useState(item?.notes ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // a sensible default end of repetition: the end of the school year
  useEffect(() => {
    if (every && !until && isYmd(start)) setUntil(`${schoolYearOf(monthOf(start)) + 1}-06-30`)
  }, [every]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const l = link.trim()
    if (!title.trim()) errs.title = "اكتب عنوان الحدث، مثل: لقاء فرع المنار."
    if (!isYmd(start)) errs.start = "اختر تاريخ الحدث."
    if (multi && (!isYmd(end) || end <= start)) errs.end = "اختر تاريخ نهاية بعد تاريخ البداية."
    if (multi && isYmd(end) && isYmd(start) && diffDays(start, end) > 60) errs.end = "مدة الحدث لا تتجاوز 60 يومًا. للمواعيد المتكررة استخدم التكرار."
    if (every && (!isYmd(until) || until <= start)) errs.until = "اختر تاريخًا بعد تاريخ الحدث يتوقف عنده التكرار."
    if (every && isYmd(until) && isYmd(start) && diffDays(start, until) > 400) errs.until = "التكرار لا يتجاوز سنة واحدة من تاريخ الحدث."
    if (l && !/^https?:\/\/\S+$/i.test(l)) errs.link = "الصق رابطًا كاملًا يبدأ بـ https://"
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    const ok = await saveEvent({
      id: item?.id ?? `ev-${Date.now().toString(36)}`,
      title: title.trim(),
      type: type as EventType,
      start,
      end: multi ? end : null,
      time: time || null,
      branch: branch || null,
      link: l || null,
      notes: notes.trim() || null,
      repeat: every ? ({ every, until } as EventRepeat) : null,
      createdAt: item?.createdAt,
    })
    setBusy(false)
    if (ok) onDone()
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
      <div>
        <L htmlFor="ev-title">العنوان</L>
        <input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="لقاء فرع المنار" aria-invalid={!!errors.title} />
        <Err text={errors.title} />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-[15px] font-medium">النوع</legend>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {EVENT_TYPES.map((t) => (
            <label key={t.key} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[15px]", type === t.key ? "border-primary bg-secondary/60 font-bold" : "hover:bg-accent")}>
              <input type="radio" name="ev-type" value={t.key} checked={type === t.key} onChange={() => setType(t.key)} className="sr-only" />
              <span className="h-3 w-3 shrink-0 rounded-full" style={dotStyle(t.key)} aria-hidden="true" />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <L htmlFor="ev-start">{multi ? "يبدأ في" : "التاريخ"}</L>
          <input id="ev-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} dir="ltr" aria-invalid={!!errors.start} />
          <Err text={errors.start} />
        </div>
        <div>
          <L htmlFor="ev-time" hint="(اختياري)">الوقت</L>
          <input id="ev-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} dir="ltr" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-[15px]">
        <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
        يمتد أكثر من يوم
      </label>
      {multi && (
        <div>
          <L htmlFor="ev-end">ينتهي في</L>
          <input id="ev-end" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={inputCls} dir="ltr" aria-invalid={!!errors.end} />
          <Err text={errors.end} />
        </div>
      )}
      <SelectField id="ev-branch" label="الفرع (اختياري)" value={branch} onChange={setBranch} options={[{ value: "", label: "حدث عام (ليس لفرع محدد)" }, ...branches.map((b) => ({ value: b.slug, label: b.name }))]} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          id="ev-repeat"
          label="التكرار"
          value={every}
          onChange={setEvery}
          options={[{ value: "", label: "لا يتكرر" }, ...(Object.keys(REPEAT_LABEL) as EventRepeat["every"][]).map((k) => ({ value: k, label: REPEAT_LABEL[k] }))]}
        />
        {every && (
          <div>
            <L htmlFor="ev-until">يتوقف بعد</L>
            <input id="ev-until" type="date" value={until} min={start} onChange={(e) => setUntil(e.target.value)} className={inputCls} dir="ltr" aria-invalid={!!errors.until} />
            <Err text={errors.until} />
          </div>
        )}
      </div>
      {every === "month" && isYmd(start) && Number(start.slice(8)) > 28 && <p className="text-[14px] text-warn">الأشهر التي ليس فيها اليوم {Number(start.slice(8))} لا يظهر فيها الحدث.</p>}
      <div>
        <L htmlFor="ev-link" hint="(اختياري: ملف أو اجتماع)">الرابط</L>
        <input id="ev-link" dir="ltr" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} className={inputCls} placeholder="https://" aria-invalid={!!errors.link} />
        <Err text={errors.link} />
      </div>
      <div>
        <L htmlFor="ev-notes" hint="(اختياري)">ملاحظات</L>
        <textarea id="ev-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls + " h-auto py-2"} />
      </div>
      {item?.repeat && <p className="text-[14px] text-muted-foreground">هذا حدث متكرر: التعديل يسري على كل مواعيده.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[16px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {item ? "حفظ التعديلات" : "إضافة الحدث"}
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
          title={`حذف «${item.title}»؟`}
          action={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  setBusy(true)
                  const ok = await deleteEvent(item.id)
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
          {item.repeat ? "يُحذف الحدث بكل مواعيده المتكررة، ولا يمكن التراجع." : "لا يمكن التراجع بعد الحذف."}
        </Banner>
      )}
    </form>
  )
}

/* ================================================================== home strip */
/** The next few events, for the open home page. */
export function UpcomingStrip({ className = "mt-5" }: { className?: string }) {
  const { data, loaded } = useStore()
  const { go } = useRouter()
  const branches = useBranches()
  const today = todayYmd()
  const next = useMemo(() => expand(data.events, today, addDays(today, 60)).slice(0, 4), [data.events, today])
  if (!loaded.events) return null
  return (
    <section className={cn("rise rounded-2xl border bg-card", className)} aria-labelledby="upcoming-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
        <h2 id="upcoming-title" className="flex items-center gap-2 text-[19px] font-bold">
          <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
          القادم في رحلة التواصل
        </h2>
        <button type="button" onClick={() => go({ page: "calendar" })} className="inline-flex items-center gap-1.5 text-[15px] font-bold text-primary hover:underline">
          التقويم كاملًا
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>
      {next.length === 0 ? (
        <p className="px-5 py-4 text-[15px] text-muted-foreground">لا أحداث مسجّلة في الشهرين القادمين.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {next.map((o) => {
            const t = typeOf(o.ev.type)
            const b = branchLabel(o.ev.branch, branches)
            const live = o.start <= today
            return (
              <li key={o.key} className="border-b last:border-0 sm:border-e lg:border-b-0">
                <button type="button" onClick={() => go({ page: "calendar" })} className="flex h-full w-full items-start gap-3 px-5 py-4 text-start hover:bg-accent/40">
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-lg py-1.5" style={{ background: `hsl(var(${t.tone.soft}))`, color: `hsl(var(${t.tone.ink}))` }}>
                    <span className="num text-[20px] font-extrabold leading-none">{Number(o.start.slice(8))}</span>
                    <span className="mt-0.5 text-[11px] font-bold">{monthName(monthOf(o.start))}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-bold leading-snug">{o.ev.title}</span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">
                      {live ? (o.start === today ? "اليوم" : "جارٍ الآن") : o.start === addDays(today, 1) ? "غدًا" : WEEKDAYS[weekday(o.start)]}
                      {o.ev.time && ` · ${timeLabel(o.ev.time)}`}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] font-medium" style={{ color: `hsl(var(${t.tone.ink}))` }}>
                      {t.label}
                      {b && <span className="text-muted-foreground"> · {b}</span>}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
