import { useMemo } from "react"
import { ArrowLeft, Megaphone } from "lucide-react"
import { useStore } from "@/data/store"
import { useRouter } from "@/lib/router"
import { accountMonth, groupByName, history, indexReadings, isWhatsApp, monthLabel, platformOf } from "@/data/social"
import { formatNumber } from "@/lib/format"
import { Octagram } from "./common"
import { Growth, PlatformBadge, Sparkline } from "./social"
import { defaultSocialMonth } from "@/pages/SocialPage"
import { CountUp } from "@/lib/motion"

/** Home-page summary of the social tab: a navy "pulse" band with one tile per active account. */
export function SocialPulse() {
  const { data } = useStore()
  const { go } = useRouter()
  const idx = useMemo(() => indexReadings(data.socialReadings), [data.socialReadings])
  const month = defaultSocialMonth(data.socialReadings)
  const accounts = data.socialAccounts.filter((a) => a.active)
  const rows = accounts
    .map((a) => ({ a, m: accountMonth(idx, a.id, month), h: history(idx, a.id, month, 6) }))
    .sort((x, y) => (y.m.growth ?? -Infinity) - (x.m.growth ?? -Infinity) || (y.m.followers ?? -1) - (x.m.followers ?? -1))
  const grew = rows.filter((r) => (r.m.growth ?? 0) > 0).length
  const top = rows.find((r) => (r.m.growth ?? 0) > 0)

  if (accounts.length === 0)
    return (
      <section className="rise mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed bg-card px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-soft text-gold-ink">
            <Megaphone className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[17px] font-bold">نبض التواصل الاجتماعي</h2>
            <p className="text-[14px] text-muted-foreground">يظهر هنا نمو حسابات التواصل وقنوات واتساب بعد إضافتها في تبويب التواصل الاجتماعي.</p>
          </div>
        </div>
        <button type="button" onClick={() => go({ page: "social" })} className="inline-flex items-center gap-1.5 text-[15px] font-bold text-primary hover:underline">
          فتح التبويب
          <ArrowLeft className="h-4 w-4" />
        </button>
      </section>
    )

  return (
    <section className="pattern-stars rise relative mt-5 overflow-hidden rounded-2xl bg-band text-band-foreground" aria-labelledby="pulse-title">
      <Octagram className="pointer-events-none absolute -bottom-16 -start-16 h-56 w-56 text-sky/20" strokeWidth={0.8} />
      <div className="relative flex flex-wrap items-end justify-between gap-3 px-5 pt-5 sm:px-6">
        <div>
          <p className="flex items-center gap-2 text-[14px] text-band-soft">
            <Megaphone className="h-4 w-4 text-gold" aria-hidden="true" />
            {monthLabel(month)} · {formatNumber(accounts.filter((a) => !isWhatsApp(a)).length)} حسابًا و{formatNumber(accounts.filter(isWhatsApp).length)} واتساب
          </p>
          <h2 id="pulse-title" className="mt-1 text-[22px] font-bold">نبض التواصل الاجتماعي</h2>
          <p className="text-[15px] text-white/80">
            {top ? (
              <>
                الأعلى نموًا: <span className="font-bold text-white">{platformOf(top.a.platform).label} · {top.a.name}</span>{" "}
                <span className="num font-bold text-gold" dir="ltr">+{formatNumber(top.m.growth!)}</span> · نمت {formatNumber(grew)} من {formatNumber(rows.length)}
              </>
            ) : (
              rows.some((r) => r.m.followers !== null) ? "لا توجد مقارنة شهرية بعد: يظهر النمو عند تسجيل أرقام شهرين متتاليين." : "أُضيفت الحسابات، ويبدأ العرض بعد تسجيل أول أرقام للمتابعين."
            )}
          </p>
        </div>
        <button type="button" onClick={() => go({ page: "social" })} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white/10 px-4 text-[15px] ring-1 ring-white/25 hover:bg-white/15">
          كل الحسابات
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>
      {rows.some((r) => r.m.followers !== null) ? (
      <ul className="relative flex gap-3 overflow-x-auto px-5 pb-5 pt-4 [scrollbar-width:thin] sm:px-6">
          {rows.map(({ a, m, h }) => (
            <li key={a.id} className="w-[13.5rem] shrink-0">
              <button
                type="button"
                onClick={() => go({ page: "social" })}
                className="flex h-full w-full flex-col rounded-xl bg-white/[0.08] p-3.5 text-start ring-1 ring-white/15 transition-colors hover:bg-white/[0.13]"
              >
                <span className="flex items-center gap-2.5">
                  <PlatformBadge platform={a.platform} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold">{a.name}</span>
                    <span className="block truncate text-[12px] text-white/65">{platformOf(a.platform).label}</span>
                  </span>
                </span>
                <span className="mt-3 flex items-end justify-between gap-2">
                  <span className="num text-[24px] font-extrabold leading-none">{m.followers !== null ? <CountUp value={m.followers} /> : <span className="text-[14px] font-normal text-white/60">لم يُسجّل</span>}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[13px]">
                    <Growth value={m.growth} className="text-[13px]" empty="—" />
                  </span>
                </span>
                <Sparkline points={h} className="mt-2 h-7 w-full" stroke="hsl(var(--gold))" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="relative grid gap-3 px-5 pb-5 pt-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {groupByName(rows).map((g) => (
            <li key={g.name} className="rounded-xl bg-white/[0.08] p-4 ring-1 ring-white/15">
              <p className="text-[16px] font-bold">{g.name}</p>
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="المنصات">
                {g.rows.map(({ a }) => (
                  <li key={a.id}>
                    <PlatformBadge platform={a.platform} size="sm" />
                    <span className="sr-only">{platformOf(a.platform).label}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[13px] text-white/70">{g.rows.length === 1 ? "حساب واحد" : g.rows.length === 2 ? "حسابان" : `${formatNumber(g.rows.length)} ${g.rows.length > 10 ? "حسابًا" : "حسابات"}`} · بانتظار تسجيل أرقام {monthLabel(month, false)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
