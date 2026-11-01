// الاستخدام: KEY=<base64> node tools/vault.mjs decrypt|encrypt <inDir> <outDir>
// المجلدات تحوي <collection>/<id>.json. المفتاح لا يُحفظ في المستودع أبداً.
import fs from "node:fs"; import path from "node:path"
const { subtle } = globalThis.crypto, te = new TextEncoder(), td = new TextDecoder()
const key = await subtle.importKey("raw", Buffer.from(process.env.KEY, "base64"), { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
const [cmd, inDir, outDir] = process.argv.slice(2); let n = 0
for (const c of fs.readdirSync(inDir)) {
  const src = path.join(inDir, c); if (!fs.statSync(src).isDirectory()) continue
  fs.mkdirSync(path.join(outDir, c), { recursive: true })
  for (const f of fs.readdirSync(src).filter((x) => x.endsWith(".json"))) {
    const id = f.slice(0, -5), doc = JSON.parse(fs.readFileSync(path.join(src, f), "utf8")), ad = te.encode(`${c}/${id}`)
    let out
    if (cmd === "decrypt") {
      if (!doc.enc) { out = { ...doc, id } } else {
        const pt = await subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(doc.enc.iv, "base64"), additionalData: ad }, key, Buffer.from(doc.enc.ct, "base64"))
        out = { ...JSON.parse(td.decode(pt)), id }
      }
    } else {
      const { id: _x, ...body } = doc, iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
      const ct = await subtle.encrypt({ name: "AES-GCM", iv, additionalData: ad }, key, te.encode(JSON.stringify(body)))
      out = { enc: { v: 1, iv: Buffer.from(iv).toString("base64"), ct: Buffer.from(ct).toString("base64") } }
    }
    fs.writeFileSync(path.join(outDir, c, f), JSON.stringify(out)); n++
  }
}
console.log(cmd, n)
