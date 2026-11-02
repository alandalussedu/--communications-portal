// Reads follower counts from the platforms' official APIs for the accounts that allow it.
//
// Usage: node tools/fetch_followers.mjs <db-dir> <month YYYY-MM> <out-dir>
//   <db-dir>/socialAccounts/<id>.json and <db-dir>/socialReadings/<id>.json  (as dumped from the database)
//   writes <out-dir>/socialReadings/<account>__<month>.json for each count read, and prints a report.
//
// Keys come from the environment only (never from files or the repository):
//   YOUTUBE_API_KEY                       YouTube Data API v3 key           → youtube accounts
//   META_ACCESS_TOKEN + META_IG_USER_ID   Meta Graph API (business_discovery) → instagram accounts
//   META_ACCESS_TOKEN                     Meta Graph API (Page followers_count) → facebook accounts
// A platform without its key is skipped and reported, never guessed.
//
// A month that already has a reading typed in by an editor is left alone:
// the tool only fills empty months or replaces its own earlier reading.

import fs from "node:fs"
import path from "node:path"

const [dbDir, month, outDir] = process.argv.slice(2)
if (!dbDir || !/^\d{4}-\d{2}$/.test(month ?? "") || !outDir) {
  console.error("usage: node tools/fetch_followers.mjs <db-dir> <YYYY-MM> <out-dir>")
  process.exit(2)
}
const { YOUTUBE_API_KEY, META_ACCESS_TOKEN, META_IG_USER_ID } = process.env
const GRAPH = "https://graph.facebook.com/v21.0"

const readDir = (c) => {
  const d = path.join(dbDir, c)
  if (!fs.existsSync(d)) return []
  return fs.readdirSync(d).filter((f) => f.endsWith(".json")).map((f) => ({ id: f.slice(0, -5), ...JSON.parse(fs.readFileSync(path.join(d, f), "utf8")) }))
}
const accounts = readDir("socialAccounts").filter((a) => a.active !== false)
const readings = new Map(readDir("socialReadings").map((r) => [r.id, r]))

/** The account name in a profile URL: youtube.com/@x, youtube.com/c/x, instagram.com/x, facebook.com/x. */
function nameFromUrl(url) {
  try {
    const u = new URL(url)
    const parts = u.pathname.split("/").filter(Boolean)
    if (!parts.length) return null
    if (parts[0].startsWith("@")) return parts[0].slice(1)
    if (["c", "user"].includes(parts[0]) && parts[1]) return parts[1]
    if (parts[0] === "share" || parts[0] === "profile.php") return null // share links do not name the page
    return parts[0]
  } catch {
    return null
  }
}
const handleOf = (a) => (a.handle ? String(a.handle).replace(/^@/, "") : null) || nameFromUrl(a.url)

async function getJson(url) {
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`)
  return body
}

const readers = {
  async youtube(a) {
    if (!YOUTUBE_API_KEY) return { skip: "لا يوجد YOUTUBE_API_KEY" }
    const h = handleOf(a)
    if (!h) return { fail: "لا يظهر اسم القناة في الرابط" }
    const base = `https://www.googleapis.com/youtube/v3/channels?part=statistics&key=${encodeURIComponent(YOUTUBE_API_KEY)}`
    let j = await getJson(`${base}&forHandle=${encodeURIComponent("@" + h)}`)
    if (!j.items?.length) j = await getJson(`${base}&forUsername=${encodeURIComponent(h)}`)
    const it = j.items?.[0]
    if (!it) return { fail: `لم تُعثر على القناة @${h}` }
    if (it.statistics?.hiddenSubscriberCount) return { fail: "القناة تخفي عدد المشتركين" }
    return { followers: Number(it.statistics.subscriberCount), via: `YouTube API · @${h}` }
  },
  async instagram(a) {
    if (!META_ACCESS_TOKEN || !META_IG_USER_ID) return { skip: "لا يوجد META_ACCESS_TOKEN أو META_IG_USER_ID" }
    const h = handleOf(a)
    if (!h) return { fail: "لا يظهر اسم الحساب في الرابط" }
    const j = await getJson(`${GRAPH}/${META_IG_USER_ID}?fields=business_discovery.username(${encodeURIComponent(h)}){followers_count}&access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`)
    const n = j.business_discovery?.followers_count
    if (typeof n !== "number") return { fail: `لم يُقرأ الحساب @${h} (يجب أن يكون حساب أعمال أو صانع محتوى)` }
    return { followers: n, via: `Instagram Graph API · @${h}` }
  },
  async facebook(a) {
    if (!META_ACCESS_TOKEN) return { skip: "لا يوجد META_ACCESS_TOKEN" }
    const h = handleOf(a)
    if (!h) return { fail: "رابط الصفحة رابط مشاركة لا يحمل اسمها؛ سجّل الرابط المباشر للصفحة" }
    const j = await getJson(`${GRAPH}/${encodeURIComponent(h)}?fields=followers_count&access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`)
    if (typeof j.followers_count !== "number") return { fail: `لم يُقرأ عدد متابعي الصفحة ${h}` }
    return { followers: j.followers_count, via: `Facebook Graph API · ${h}` }
  },
}

const now = new Date().toISOString()
const report = []
let written = 0
for (const a of accounts) {
  const reader = readers[a.platform]
  if (!reader) continue
  const id = `${a.id}__${month}`
  const prev = readings.get(id)
  if (prev && prev.source !== "api") {
    report.push(`- ${a.name} · ${a.platform}: تُرك كما هو (أدخله محرر يدويًا: ${prev.followers})`)
    continue
  }
  let r
  try {
    r = await reader(a)
  } catch (e) {
    r = { fail: e.message }
  }
  if (r.skip) report.push(`- ${a.name} · ${a.platform}: تُخطّي (${r.skip})`)
  else if (r.fail) report.push(`- ${a.name} · ${a.platform}: فشل (${r.fail})`)
  else if (!Number.isFinite(r.followers)) report.push(`- ${a.name} · ${a.platform}: فشل (قيمة غير رقمية)`)
  else {
    if (prev && prev.followers === r.followers) {
      report.push(`- ${a.name} · ${a.platform}: ${r.followers} (لا تغيير)`)
      continue
    }
    fs.mkdirSync(path.join(outDir, "socialReadings"), { recursive: true })
    const doc = { account: a.id, month, followers: r.followers, recordedAt: now, source: "api", via: r.via }
    fs.writeFileSync(path.join(outDir, "socialReadings", `${id}.json`), JSON.stringify(doc))
    written++
    report.push(`- ${a.name} · ${a.platform}: ${prev ? `${prev.followers} ← ` : ""}${r.followers}`)
  }
}
console.log(`الشهر ${month} · قراءات جديدة أو متغيرة: ${written}`)
console.log(report.join("\n"))
