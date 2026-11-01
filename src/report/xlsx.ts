/**
 * Excel export: the rows behind the report, one sheet per table, with Arabic
 * headers, filters on every header row and right-to-left sheets.
 */
import * as XLSX from "xlsx"
import { ALERT_KIND_LABEL } from "@/data/insights"
import { formatDate, formatTime } from "@/lib/format"
import { comparisonRows, componentRows, stageRows, type ReportModel } from "./model"

type Row = Record<string, string | number | null>

function sheet(rows: Row[], fallback: Row): XLSX.WorkSheet {
  const data = rows.length ? rows : [fallback]
  const ws = XLSX.utils.json_to_sheet(data)
  const headers = Object.keys(data[0])
  ws["!cols"] = headers.map((h) => {
    const longest = Math.max(h.length, ...data.map((r) => String(r[h] ?? "").length))
    return { wch: Math.min(60, Math.max(10, longest + 2)) }
  })
  if (rows.length) ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length, c: headers.length - 1 } }) }
  return ws
}

export function exportXlsx(m: ReportModel): Blob {
  const wb = XLSX.utils.book_new()
  const info: Row[] = [
    { "البند": "عنوان التقرير", "القيمة": m.title },
    { "البند": "تاريخ ووقت الإنشاء", "القيمة": `${formatDate(m.generatedAt)} ${formatTime(m.generatedAt)}` },
    { "البند": "العام الدراسي", "القيمة": m.year },
    { "البند": "الفترة", "القيمة": m.periodName },
    { "البند": "الفروع المشمولة", "القيمة": m.rows.map((r) => r.b.name).join("، ") },
    { "البند": "المعاملات", "القيمة": m.indicators.map((i) => i.title).join("، ") },
    { "البند": "الخطط العلاجية والتحسينية", "القيمة": m.opts.includePlans ? "مطلوبة، ولا يوجد جدول لها في الملفات المقروءة" : "غير مضمّنة" },
    { "البند": "المنهجية", "القيمة": "القيم منقولة كما وردت في ملفات المنصة الشاملة. حالة التحقيق مقارنة مباشرة بين نتيجة الفترة ومستهدفها عندما يكونان نسبتين مئويتين. لا يوجد متوسط للشركة." },
    ...m.summary.map((s, i) => ({ "البند": `الملخص ${i + 1}`, "القيمة": s })),
  ]
  XLSX.utils.book_append_sheet(wb, sheet(info, {}), "معلومات التقرير")
  XLSX.utils.book_append_sheet(wb, sheet(comparisonRows(m), { "ملاحظة": "لا توجد فروع مشمولة" }), "مقارنة الفروع")
  XLSX.utils.book_append_sheet(wb, sheet(stageRows(m), { "ملاحظة": "لم تُقرأ تفاصيل المراحل لأي فرع مشمول" }), "المراحل")
  const comps = componentRows(m)
  if (m.opts.indicators.includes("communication"))
    XLSX.utils.book_append_sheet(wb, sheet(comps, { "ملاحظة": "لا توجد قيم مكونات مقروءة" }), "مكونات جودة التواصل")
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ...m.followUps.map((a) => ({
          "الفرع": a.branch?.name ?? "",
          "النوع": ALERT_KIND_LABEL[a.kind],
          "الأولوية": a.severity === "high" ? "عالية" : a.severity === "medium" ? "متوسطة" : "منخفضة",
          "العنوان": a.title,
          "السبب": a.reason,
          "تاريخ الرصد": a.detectedAt ?? "",
        })),
      ],
      { "ملاحظة": "لا توجد حالات تحتاج متابعة" },
    ),
    "المتابعة",
  )
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      m.sources.map((s) => ({
        "المصدر": s.title,
        "النطاق": s.scope,
        "آخر محاولة": s.lastAttempt ?? "",
        "آخر نجاح": s.lastSuccess ?? "",
        "النتيجة": s.result === "success" ? "نجحت" : s.result === "partial" ? "نجحت جزئيًا" : s.result === "failed" ? "فشلت" : "",
        "طريقة القراءة": s.method,
        "الرابط": s.url ?? "",
      })),
      { "ملاحظة": "لا مصادر" },
    ),
    "المصادر",
  )
  wb.Workbook = { Views: [{ RTL: true }] }
  wb.Props = { Title: m.title, Author: "إدارة التواصل المؤسسي" }
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}
