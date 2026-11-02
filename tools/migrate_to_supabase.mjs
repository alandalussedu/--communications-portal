// One-time move from the Claude platform database to Supabase.
//
// Usage: [KEY=<base64 data key>] node tools/migrate_to_supabase.mjs <db-dump-dir> <out-dir>
//   Without KEY, encrypted documents are skipped (reported), and only the open ones are written.
//   <db-dump-dir>/<collection>/<id>.json as saved by ArtifactData (out_dir).
//   Writes <out-dir>/part-NN.sql: upserts into public.docs.
//
// Protected collections were stored encrypted ({enc}) because the old public copy
// was downloadable by anyone. In Supabase they are protected by the database
// rules instead (only signed-in members can read them), so they are stored open.
// The key comes from the environment only and is never written anywhere.
import fs from "node:fs"
import path from "node:path"

const [dumpDir, outDir] = process.argv.slice(2)
if (!dumpDir || !outDir) {
  console.error("usage: [KEY=...] node tools/migrate_to_supabase.mjs <dump> <out>")
  process.exit(2)
}
const COLLECTIONS = ["files", "settings", "socialAccounts", "socialReadings", "events", "branches", "indicators", "stages", "meta", "syncLog", "alertState",
  "remedialFiles", "remedialStages", "remedialRows", "remedialMonthly", "remedialLog", "remedialSync", "competitors", "competitorsMeta"]
const { subtle } = globalThis.crypto
const td = new TextDecoder(), te = new TextEncoder()
// The setting may carry extra text around the key (a "KEY=" prefix, spaces, a new line):
// take the one 32-byte base64 value (44 characters ending in "=") and nothing else.
function keyBytes(raw) {
  const found = raw.match(/[A-Za-z0-9+/]{43}=/g) ?? []
  const valid = [...new Set(found)].filter((k) => Buffer.from(k, "base64").length === 32)
  if (valid.length !== 1) {
    console.error(`KEY: expected exactly one 32-byte base64 key in the value, found ${valid.length}`)
    process.exit(3)
  }
  return Buffer.from(valid[0], "base64")
}
const key = process.env.KEY ? await subtle.importKey("raw", keyBytes(process.env.KEY), { name: "AES-GCM" }, false, ["decrypt"]) : null

// the id is the row key in Supabase, not part of the document
const META_FIELDS = new Set(["id"])
const body = (doc) => doc

const q = (s) => "'" + s.replace(/'/g, "''") + "'"
const rows = []
const counts = {}
let opened = 0
let skipped = 0
for (const c of COLLECTIONS) {
  const dir = path.join(dumpDir, c)
  if (!fs.existsSync(dir)) {
    counts[c] = 0
    continue
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
  counts[c] = files.length
  for (const f of files) {
    const id = f.slice(0, -5)
    let doc = body(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    if (doc?.enc && !key) {
      skipped++
      continue
    }
    if (doc?.enc) {
      const pt = await subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(doc.enc.iv, "base64"), additionalData: te.encode(`${c}/${id}`) }, key, Buffer.from(doc.enc.ct, "base64"))
      doc = JSON.parse(td.decode(pt))
      opened++
    }
    const clean = Object.fromEntries(Object.entries(doc).filter(([k]) => !META_FIELDS.has(k)))
    rows.push(`(${q(c)},${q(id)},${q(JSON.stringify(clean))}::jsonb)`)
  }
}

fs.mkdirSync(outDir, { recursive: true })
const MAX = 300_000
let part = [], size = 0, n = 0
const flush = () => {
  if (!part.length) return
  n++
  fs.writeFileSync(path.join(outDir, `part-${String(n).padStart(2, "0")}.sql`),
    `insert into public.docs (collection, id, data) values\n${part.join(",\n")}\non conflict (collection, id) do update set data = excluded.data;\n`)
  part = []
  size = 0
}
for (const r of rows) {
  if (size + r.length > MAX) flush()
  part.push(r)
  size += r.length
}
flush()
console.log(JSON.stringify({ docs: rows.length, decrypted: opened, skippedEncrypted: skipped, parts: n, counts }))
