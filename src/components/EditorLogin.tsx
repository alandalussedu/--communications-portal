import { useState } from "react"
import { Loader2, LogOut, UserRound, UserRoundCheck } from "lucide-react"
import { toast } from "sonner"
import { backendConfigured, signIn, signOut, useSession } from "@/lib/backend"
import { useStore } from "@/data/store"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

/** Sign-in for editors on the public site and the app. Hidden until Supabase is set up. */
export function EditorLogin({ onBand = false }: { onBand?: boolean }) {
  const session = useSession()
  const { canEdit } = useStore()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!backendConfigured) return null

  const signedIn = !!session
  const inputCls = "h-11 w-full rounded-md border border-input bg-card px-3 text-[16px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={signedIn ? "حساب المحرر" : "دخول المحررين"}
        aria-label={signedIn ? "حساب المحرر" : "دخول المحررين"}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors",
          onBand ? "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20" : "bg-muted text-foreground hover:bg-muted/70",
        )}
      >
        {signedIn ? <UserRoundCheck className="h-5 w-5" aria-hidden="true" /> : <UserRound className="h-5 w-5" aria-hidden="true" />}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-md" dir="rtl">
          <SheetHeader className="pe-8 text-start">
            <SheetTitle className="text-start text-[22px] font-bold">{signedIn ? "حساب المحرر" : "دخول المحررين"}</SheetTitle>
            <SheetDescription className="text-start text-[15px]">
              {signedIn ? "أزرار الإضافة والتعديل ظاهرة في الصفحات ما دمت مسجّلًا." : "لفريق إدارة التواصل المؤسسي. التصفح لا يحتاج تسجيل دخول."}
            </SheetDescription>
          </SheetHeader>
          {signedIn ? (
            <div className="mt-5 space-y-4">
              <p className="rounded-lg bg-muted px-4 py-3 text-[15px]">
                <span className="block text-[13px] text-muted-foreground">مسجّل باسم</span>
                <span className="block break-all font-bold">{session.user.email}</span>
              </p>
              {!canEdit && <p className="text-[14px] text-warn">هذا الحساب غير مضاف إلى قائمة المحررين بعد، فلا تظهر له أزرار التعديل. اطلب إضافته من صاحب المنصة.</p>}
              <button
                type="button"
                onClick={async () => {
                  await signOut()
                  toast.success("سُجّل الخروج")
                  setOpen(false)
                }}
                className="inline-flex h-11 items-center gap-2 rounded-full border px-5 text-[15px] hover:bg-accent"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                تسجيل الخروج
              </button>
            </div>
          ) : (
            <form
              className="mt-5 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault()
                setBusy(true)
                setError(null)
                const err = await signIn(email, password)
                setBusy(false)
                if (err) return setError(err)
                setPassword("")
                toast.success("تم تسجيل الدخول")
                setOpen(false)
              }}
            >
              <div>
                <label htmlFor="ed-email" className="mb-1 block text-[15px] font-medium">البريد الإلكتروني</label>
                <input id="ed-email" type="email" autoComplete="username" inputMode="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="ed-pass" className="mb-1 block text-[15px] font-medium">كلمة المرور</label>
                <input id="ed-pass" type="password" autoComplete="current-password" dir="ltr" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
              </div>
              {error && <p className="text-[14px] text-bad" role="alert">{error}</p>}
              <button type="submit" disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-[16px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                دخول
              </button>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
