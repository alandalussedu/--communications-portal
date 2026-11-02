// admin-members: user management for «بوابة التواصل المؤسسي».
// Only an active owner (public.members.role = 'owner') may call it.
// Actions: list · create · reset · update. Temporary passwords are returned once
// to the owner and never stored or logged.
import { createClient } from "npm:@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } })
const fail = (error: string, status = 400) => json({ error }, status)

const ROLES = ["viewer", "editor", "owner"] as const
const loginOf = (phone: string) => `m${phone}@members.andalus.invalid`

/** 12 characters, no look-alikes (0/O, 1/l/I), grouped for reading aloud: Xxx-xxx-xxx-xxx */
function tempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  const s = [...bytes].map((b) => chars[b % chars.length]).join("")
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return fail("method not allowed", 405)

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })

  // who is calling?
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
  const { data: who } = await admin.auth.getUser(token)
  if (!who?.user) return fail("سجّل الدخول أولًا.", 401)
  const { data: me } = await admin.from("members").select("role, active").eq("user_id", who.user.id).maybeSingle()
  if (!me?.active || me.role !== "owner") return fail("هذا الإجراء لمدير المنصة فقط.", 403)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail("طلب غير صالح.")
  }

  switch (body.action) {
    case "list": {
      const { data: rows, error } = await admin.from("members").select("user_id, name, phone, role, active, must_change_password, created_at").order("name")
      if (error) return fail("تعذّر قراءة المستخدمين.", 500)
      const last = new Map<string, string | null>()
      for (let page = 1; page < 20; page++) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
        for (const u of data?.users ?? []) last.set(u.id, u.last_sign_in_at ?? null)
        if (!data || data.users.length < 200) break
      }
      return json(rows.map((r) => ({ ...r, last_sign_in_at: last.get(r.user_id) ?? null })))
    }

    case "create": {
      const name = String(body.name ?? "").trim().slice(0, 80)
      const phone = String(body.phone ?? "")
      const role = String(body.role ?? "viewer")
      if (!name) return fail("اكتب الاسم.")
      if (!/^9665\d{8}$/.test(phone)) return fail("رقم الجوال غير صالح.")
      if (!ROLES.includes(role as (typeof ROLES)[number])) return fail("الدور غير صالح.")
      const { data: exists } = await admin.from("members").select("user_id").eq("phone", phone).maybeSingle()
      if (exists) return fail("يوجد حساب بهذا الرقم.")
      const password = tempPassword()
      const { data: created, error } = await admin.auth.admin.createUser({ email: loginOf(phone), password, email_confirm: true, user_metadata: { name } })
      if (error || !created.user) return fail(/already/i.test(error?.message ?? "") ? "يوجد حساب بهذا الرقم." : "تعذّر إنشاء الحساب.", 400)
      const ins = await admin.from("members").insert({ user_id: created.user.id, name, phone, role, created_by: who.user.id })
      if (ins.error) {
        await admin.auth.admin.deleteUser(created.user.id)
        return fail("تعذّر حفظ بيانات المستخدم.", 500)
      }
      return json({ user_id: created.user.id, password })
    }

    case "reset": {
      const id = String(body.user_id ?? "")
      const { data: m } = await admin.from("members").select("user_id, active").eq("user_id", id).maybeSingle()
      if (!m) return fail("المستخدم غير موجود.", 404)
      if (!m.active) return fail("فعّل الحساب أولًا.")
      const password = tempPassword()
      const { error } = await admin.auth.admin.updateUserById(id, { password })
      if (error) return fail("تعذّرت إعادة التعيين.", 500)
      await admin.from("members").update({ must_change_password: true }).eq("user_id", id)
      return json({ password })
    }

    case "update": {
      const id = String(body.user_id ?? "")
      if (id === who.user.id && (body.role !== undefined || body.active !== undefined)) return fail("لا يمكنك تغيير دورك أو إيقاف حسابك بنفسك.")
      const patch: Record<string, unknown> = {}
      if (body.role !== undefined) {
        if (!ROLES.includes(body.role as (typeof ROLES)[number])) return fail("الدور غير صالح.")
        patch.role = body.role
      }
      if (body.name !== undefined) patch.name = String(body.name).trim().slice(0, 80)
      if (body.active !== undefined) {
        patch.active = !!body.active
        // a stopped account cannot sign in or refresh its session
        const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: body.active ? "none" : "876000h" })
        if (error) return fail("تعذّر تحديث حالة الحساب.", 500)
      }
      if (!Object.keys(patch).length) return fail("لا يوجد تعديل.")
      const { error } = await admin.from("members").update(patch).eq("user_id", id)
      if (error) return fail("تعذّر حفظ التعديل.", 500)
      return json({ ok: true })
    }

    default:
      return fail("إجراء غير معروف.")
  }
})
