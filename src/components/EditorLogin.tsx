import { useState } from "react"
import { Eye, EyeOff, KeyRound, Loader2, LogOut, ShieldCheck, UserRound, UserRoundCheck, Users } from "lucide-react"
import { toast } from "sonner"
import { backendConfigured, changeMyPassword, normalizePhone, signIn, signOut, useSession } from "@/lib/backend"
import { useStore, type MemberRole } from "@/data/store"
import { useRouter } from "@/lib/router"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

export const ROLE_LABEL: Record<MemberRole, string> = { viewer: "مسؤول تواصل", editor: "محرر", owner: "مدير المنصة" }
const inputCls = "h-11 w-full rounded-md border border-input bg-card px-3 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
const primaryBtn = "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-[16px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input id={id} type={show ? "text" : "password"} autoComplete={autoComplete} dir="ltr" required value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "pl-3 pr-12")} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent" aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

/** Mobile number + password. Used in the header sheet and in place of the old shared password. */
export function LoginForm({ onDone }: { onDone?: () => void }) {
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        const err = await signIn(phone, password)
        setBusy(false)
        if (err) return setError(err)
        setPassword("")
        onDone?.()
      }}
    >
      <div>
        <label htmlFor="m-phone" className="mb-1 block text-[15px] font-medium">رقم الجوال</label>
        <input id="m-phone" type="tel" inputMode="tel" autoComplete="username" dir="ltr" placeholder="05XXXXXXXX" required value={phone} onChange={(e) => setPhone(e.target.value)} className={cn(inputCls, "text-start")} />
      </div>
      <div>
        <label htmlFor="m-pass" className="mb-1 block text-[15px] font-medium">كلمة المرور</label>
        <PasswordInput id="m-pass" value={password} onChange={setPassword} autoComplete="current-password" />
      </div>
      {error && <p className="text-[14px] text-bad" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className={primaryBtn}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        دخول
      </button>
      <p className="text-[13px] leading-relaxed text-muted-foreground">نسيت كلمة المرور أو لا تملك حسابًا؟ تواصل مع إدارة التواصل المؤسسي.</p>
    </form>
  )
}

export function ChangePasswordForm({ onDone, first = false }: { onDone?: () => void; first?: boolean }) {
  const { member } = useStore()
  const session = useSession()
  const [p1, setP1] = useState("")
  const [p2, setP2] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setError(null)
        if (p1.length < 8) return setError("كلمة المرور 8 أحرف أو أرقام على الأقل.")
        const myPhone = /^m(\d+)@/.exec(session?.user.email ?? "")?.[1]
        if (myPhone && normalizePhone(p1) === myPhone) return setError("لا تجعل كلمة المرور رقم جوالك.")
        if (p1 !== p2) return setError("الكلمتان غير متطابقتين.")
        setBusy(true)
        const err = await changeMyPassword(p1)
        setBusy(false)
        if (err) return setError(err)
        setP1("")
        setP2("")
        toast.success(first ? "تم ضبط كلمة المرور. أهلًا بك" : "تغيّرت كلمة المرور")
        member.recheck()
        onDone?.()
      }}
    >
      <div>
        <label htmlFor="np1" className="mb-1 block text-[15px] font-medium">كلمة المرور الجديدة</label>
        <PasswordInput id="np1" value={p1} onChange={setP1} autoComplete="new-password" />
        <p className="mt-1 text-[13px] text-muted-foreground">8 أحرف أو أرقام على الأقل، بحسب رغبتك. لا تكون رقم جوالك.</p>
      </div>
      <div>
        <label htmlFor="np2" className="mb-1 block text-[15px] font-medium">أعد كتابتها</label>
        <PasswordInput id="np2" value={p2} onChange={setP2} autoComplete="new-password" />
      </div>
      {error && <p className="text-[14px] text-bad" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className={primaryBtn}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        حفظ كلمة المرور
      </button>
    </form>
  )
}

/** First sign-in with a temporary password: nothing else opens until it is changed. */
export function ForcePasswordChange() {
  const session = useSession()
  const { member } = useStore()
  const open = !!session && member.enabled && member.checked && member.mustChange
  return (
    <Sheet open={open}>
      <SheetContent side="bottom" className="mx-auto max-h-[100dvh] max-w-lg overflow-y-auto rounded-t-2xl [&>button]:hidden" dir="rtl" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <SheetHeader className="text-start">
          <SheetTitle className="flex items-center gap-2 text-start text-[22px] font-bold">
            <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />
            اختر كلمة مرور خاصة بك
          </SheetTitle>
          <SheetDescription className="text-start text-[15px]">دخلت بكلمة مرور مؤقتة. اختر كلمة مرور جديدة لا يعرفها غيرك قبل المتابعة.</SheetDescription>
        </SheetHeader>
        <div className="mt-5 pb-[env(safe-area-inset-bottom)]">
          <ChangePasswordForm first />
          <button type="button" onClick={() => void signOut()} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[15px] text-muted-foreground hover:bg-accent">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            تسجيل الخروج
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Header button: sign in, or the signed-in member's account. Hidden until Supabase is set up. */
export function EditorLogin({ onBand = false }: { onBand?: boolean }) {
  const session = useSession()
  const { member } = useStore()
  const { go } = useRouter()
  const [open, setOpen] = useState(false)
  const [changing, setChanging] = useState(false)
  if (!backendConfigured) return null

  const signedIn = !!session
  const label = signedIn ? "حسابي" : "تسجيل الدخول"
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={label}
        aria-label={label}
        className={cn(
          "inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-[14px] transition-colors",
          onBand ? "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20" : "bg-muted text-foreground hover:bg-muted/70",
        )}
      >
        {signedIn ? <UserRoundCheck className="h-5 w-5" aria-hidden="true" /> : <UserRound className="h-5 w-5" aria-hidden="true" />}
        <span className="hidden sm:inline">{signedIn ? member.name ?? "حسابي" : "دخول"}</span>
      </button>
      <Sheet open={open} onOpenChange={(o) => (setOpen(o), setChanging(false))}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-md" dir="rtl">
          <SheetHeader className="pe-8 text-start">
            <SheetTitle className="text-start text-[22px] font-bold">{signedIn ? "حسابي" : "تسجيل الدخول"}</SheetTitle>
            <SheetDescription className="text-start text-[15px]">
              {signedIn ? "حسابك في بوابة التواصل المؤسسي." : "لمسؤولي التواصل وفريق إدارة التواصل المؤسسي. تصفّح المنصة العام لا يحتاج دخولًا."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-5">
            {!signedIn ? (
              <LoginForm onDone={() => setOpen(false)} />
            ) : changing ? (
              <ChangePasswordForm onDone={() => setChanging(false)} />
            ) : (
              <div className="space-y-4">
                <p className="rounded-lg bg-muted px-4 py-3 text-[15px]">
                  <span className="block font-bold">{member.name ?? "—"}</span>
                  <span className="block text-[14px] text-muted-foreground">{member.role ? ROLE_LABEL[member.role] : "الحساب غير مفعّل في المنصة"}</span>
                </p>
                {member.role === "owner" && (
                  <button type="button" onClick={() => (setOpen(false), go({ page: "members" }))} className="inline-flex h-11 w-full items-center gap-2 rounded-xl border px-4 text-[15px] hover:bg-accent">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    إدارة المستخدمين
                  </button>
                )}
                <button type="button" onClick={() => setChanging(true)} className="inline-flex h-11 w-full items-center gap-2 rounded-xl border px-4 text-[15px] hover:bg-accent">
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  تغيير كلمة المرور
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut()
                    toast.success("سُجّل الخروج")
                    setOpen(false)
                  }}
                  className="inline-flex h-11 w-full items-center gap-2 rounded-xl border px-4 text-[15px] hover:bg-accent"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  تسجيل الخروج
                </button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
