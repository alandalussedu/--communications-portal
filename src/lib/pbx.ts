/**
 * Reads a 3CX call report (the «Call Time / Caller ID / Destination / … / Status»
 * export, tab or comma separated, UTF-16 or UTF-8) in the browser and keeps only
 * per-extension counts. The Caller ID column is never read: callers' numbers do
 * not leave the file and are not stored.
 *
 * Counting, per officer, on their own extension(s):
 *  - attempts   = rows whose Destination is the extension, «Answered» or «Unanswered»
 *  - answered   = «Answered» rows
 *  - voicemail  = rows «Voicemail Box (ext)» (the same unanswered calls, ended in voicemail)
 *  - «Waiting» rows are left out (still ringing when the report was pulled)
 */
import type { PbxLine, PbxOfficer } from "@/data/types"

export type PbxRow = { day: string; ext: string; voicemail: boolean; status: "answered" | "unanswered" | "waiting" | "other" }
export type PbxFile = { rows: PbxRow[]; months: { month: string; count: number }[] }

function decode(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf)
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf)
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(buf)
  // UTF-16 without a BOM: every other byte is zero in the header
  if (b.length > 4 && b[1] === 0 && b[3] === 0) return new TextDecoder("utf-16le").decode(buf)
  return new TextDecoder("utf-8").decode(buf)
}

function splitLine(line: string, sep: string): string[] {
  if (sep === "\t") return line.split("\t").map((c) => c.trim())
  const out: string[] = []
  let cur = "", q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) {
      if (ch === '"' && line[i + 1] === '"') (cur += '"'), i++
      else if (ch === '"') q = false
      else cur += ch
    } else if (ch === '"') q = true
    else if (ch === sep) (out.push(cur.trim()), (cur = ""))
    else cur += ch
  }
  out.push(cur.trim())
  return out
}

export class PbxFormatError extends Error {}

export function parsePbx(buf: ArrayBuffer): PbxFile {
  const text = decode(buf).replace(/^﻿/, "")
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) throw new PbxFormatError("الملف فارغ.")
  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") && !lines[0].includes(",") ? ";" : ","
  const head = splitLine(lines[0], sep).map((h) => h.toLowerCase())
  const col = (name: string) => head.findIndex((h) => h === name)
  const iTime = col("call time"), iDest = col("destination"), iStatus = col("status")
  if (iTime < 0 || iDest < 0 || iStatus < 0) throw new PbxFormatError("هذا ليس تقرير مكالمات 3CX: لم تُوجد أعمدة «Call Time» و«Destination» و«Status».")
  const rows: PbxRow[] = []
  const months = new Map<string, number>()
  for (let i = 1; i < lines.length; i++) {
    const c = splitLine(lines[i], sep)
    const day = (c[iTime] ?? "").slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue // the «Totals» line and anything else
    const dest = c[iDest] ?? ""
    const m = dest.match(/\((\d{2,6})\)\s*$/)
    const s = (c[iStatus] ?? "").toLowerCase()
    months.set(day.slice(0, 7), (months.get(day.slice(0, 7)) ?? 0) + 1)
    if (!m) continue
    rows.push({ day, ext: m[1], voicemail: /^voicemail/i.test(dest), status: s === "answered" ? "answered" : s === "unanswered" ? "unanswered" : s === "waiting" ? "waiting" : "other" })
  }
  if (!months.size) throw new PbxFormatError("لم تُوجد في الملف مكالمات بتاريخ صحيح.")
  return { rows, months: [...months].map(([month, count]) => ({ month, count })).sort((a, b) => b.count - a.count) }
}

/** The month's lines for the active officers, plus the dates the file covers inside that month. */
export function countMonth(file: PbxFile, month: string, officers: PbxOfficer[]) {
  const rows = file.rows.filter((r) => r.day.startsWith(month))
  let waiting = 0
  const lines: PbxLine[] = officers
    .filter((o) => o.active)
    .sort((a, b) => a.order - b.order)
    .map((o) => {
      const mine = rows.filter((r) => o.exts.includes(r.ext))
      const calls = mine.filter((r) => !r.voicemail)
      waiting += calls.filter((r) => r.status === "waiting").length
      const answered = calls.filter((r) => r.status === "answered").length
      const unanswered = calls.filter((r) => r.status === "unanswered").length
      const voicemail = Math.min(unanswered, mine.filter((r) => r.voicemail).length)
      return { officer: o.id, name: o.name, branch: o.branch, school: o.school, exts: o.exts, attempts: answered + unanswered, answered, unanswered, voicemail }
    })
  const days = file.rows.length ? [...new Set(rowsDays(file, month))].sort() : []
  return { lines, waiting, from: days[0] ?? null, to: days[days.length - 1] ?? null }
}

function rowsDays(file: PbxFile, month: string) {
  return file.rows.filter((r) => r.day.startsWith(month)).map((r) => r.day)
}

/* ------------------------------------------------------------ rating (as in the approved monthly report) */
export const SMALL_SAMPLE = 5
export const rate = (l: Pick<PbxLine, "attempts" | "answered">) => (l.attempts ? (l.answered / l.attempts) * 100 : null)
export type Grade = "good" | "follow" | "weak" | "small" | "none"
export function gradeOf(l: PbxLine): Grade {
  const r = rate(l)
  if (r === null) return "none"
  if (l.attempts < SMALL_SAMPLE) return "small"
  return r >= 70 ? "good" : r >= 50 ? "follow" : "weak"
}
/** highest response first; equal rates by more attempts; officers without calls last */
export const ranked = (lines: PbxLine[]) =>
  [...lines].sort((a, b) => (rate(b) ?? -1) - (rate(a) ?? -1) || b.attempts - a.attempts || a.name.localeCompare(b.name, "ar"))

export const lastDayOf = (month: string) => {
  const [y, m] = month.split("-").map(Number)
  return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`
}
export const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`)
