// send-push: sends a notification to the iOS app through Apple (APNs).
// Only an active owner may call it. Recipients: everyone, the management team
// (editors and owners), or the communication officers (viewers).
// Secrets (set in Supabase → Edge Functions → Secrets, never in the repository):
//   APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY (the .p8 file's text), APNS_BUNDLE_ID
import { createClient } from "npm:@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } })
const fail = (error: string, status = 400) => json({ error }, status)

const AUDIENCE: Record<string, string[]> = { all: ["viewer", "editor", "owner"], team: ["editor", "owner"], officers: ["viewer"] }

/* ------------------------------------------------------------ APNs auth token (ES256 JWT, reused up to 50 minutes) */
const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b)
  let s = ""
  for (const x of bytes) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
let cached: { jwt: string; at: number } | null = null
async function apnsJwt(): Promise<string> {
  if (cached && Date.now() - cached.at < 50 * 60 * 1000) return cached.jwt
  const pem = (Deno.env.get("APNS_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n")
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"])
  const head = b64url(JSON.stringify({ alg: "ES256", kid: Deno.env.get("APNS_KEY_ID") }))
  const claims = b64url(JSON.stringify({ iss: Deno.env.get("APNS_TEAM_ID"), iat: Math.floor(Date.now() / 1000) }))
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(`${head}.${claims}`))
  cached = { jwt: `${head}.${claims}.${b64url(sig)}`, at: Date.now() }
  return cached.jwt
}

/** Production first (TestFlight and App Store builds); a token from an Xcode run belongs to the sandbox. */
async function sendOne(token: string, payload: string): Promise<"ok" | "gone" | "failed"> {
  for (const host of ["api.push.apple.com", "api.sandbox.push.apple.com"]) {
    const res = await fetch(`https://${host}/3/device/${token}`, {
      method: "POST",
      headers: {
        authorization: `bearer ${await apnsJwt()}`,
        "apns-topic": Deno.env.get("APNS_BUNDLE_ID") ?? "",
        "apns-push-type": "alert",
        "apns-priority": "10",
        "content-type": "application/json",
      },
      body: payload,
    })
    if (res.ok) return "ok"
    const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason ?? ""
    if (reason === "BadDeviceToken" && host === "api.push.apple.com") continue // try the sandbox
    if (res.status === 410 || reason === "Unregistered" || reason === "BadDeviceToken") return "gone"
    console.error("apns", res.status, reason)
    return "failed"
  }
  return "gone"
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return fail("method not allowed", 405)
  for (const k of ["APNS_KEY_ID", "APNS_TEAM_ID", "APNS_PRIVATE_KEY", "APNS_BUNDLE_ID"])
    if (!Deno.env.get(k)) return fail("الإشعارات غير مهيأة بعد: مفتاح Apple غير مضاف في إعدادات الخادم.", 503)

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })
  const auth = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
  const { data: who } = await admin.auth.getUser(auth)
  if (!who?.user) return fail("سجّل الدخول أولًا.", 401)
  const { data: me } = await admin.from("members").select("role, active").eq("user_id", who.user.id).maybeSingle()
  if (!me?.active || me.role !== "owner") return fail("إرسال الإشعارات لمدير المنصة فقط.", 403)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail("طلب غير صالح.")
  }
  const title = String(body.title ?? "").trim().slice(0, 80)
  const text = String(body.body ?? "").trim().slice(0, 240)
  const route = typeof body.route === "string" && /^[a-z0-9-]{1,60}$/.test(body.route) ? body.route : null
  const roles = AUDIENCE[String(body.audience ?? "")]
  if (!title || !text) return fail("اكتب عنوان الإشعار ونصه.")
  if (!roles) return fail("اختر المستلمين.")

  const { data: members } = await admin.from("members").select("user_id").eq("active", true).in("role", roles)
  const ids = (members ?? []).map((m) => m.user_id)
  if (!ids.length) return json({ members: 0, devices: 0, sent: 0, failed: 0 })
  const { data: tokens } = await admin.from("push_tokens").select("token, user_id").in("user_id", ids)

  const payload = JSON.stringify({ aps: { alert: { title, body: text }, sound: "default" }, ...(route ? { route } : {}) })
  let sent = 0, failed = 0
  const gone: string[] = []
  for (const t of tokens ?? []) {
    const r = await sendOne(t.token, payload)
    if (r === "ok") sent++
    else if (r === "gone") gone.push(t.token)
    else failed++
  }
  if (gone.length) await admin.from("push_tokens").delete().in("token", gone)
  const reached = new Set((tokens ?? []).filter((t) => !gone.includes(t.token)).map((t) => t.user_id)).size
  return json({ members: ids.length, devices: (tokens ?? []).length, reached, sent, failed, removed: gone.length })
})
