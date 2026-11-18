import { DirectionProvider } from "@radix-ui/react-direction"
import { Toaster } from "@/components/ui/sonner"
import { DataProvider } from "@/data/store"
import { RouterProvider, useRouter } from "@/lib/router"
import { Shell } from "@/components/Shell"
import { IndicatorsHomePage } from "@/pages/OverviewPage"
import { HomePage } from "@/pages/HomePage"
import { LockedArea } from "@/components/LockedArea"
import { signOut } from "@/lib/backend"
import { BranchPage } from "@/pages/BranchPage"
import { LibraryPage } from "@/pages/LibraryPage"
import { SourcesPage } from "@/pages/SourcesPage"
import { BuilderPage } from "@/pages/BuilderPage"
import { SocialPage } from "@/pages/SocialPage"
import { RemedialPage } from "@/pages/RemedialPage"
import { CompetitorsPage } from "@/pages/CompetitorsPage"
import { CalendarPage } from "@/pages/CalendarPage"
import { MembersPage } from "@/pages/MembersPage"
import { CsrPage } from "@/pages/CsrPage"
import { ComplaintsPage } from "@/pages/ComplaintsPage"
import { PbxPage } from "@/pages/PbxPage"
import { StudentsPage } from "@/pages/students/StudentsPage"
import { DisplayPage } from "@/pages/DisplayPage"
import { ContactsPage } from "@/pages/ContactsPage"
import { TransportPage } from "@/pages/TransportPage"
import { ForcePasswordChange } from "@/components/EditorLogin"
import { useEffect } from "react"
import { useStore } from "@/data/store"
import { useSession } from "@/lib/backend"
import { enablePush, startNative } from "@/lib/native"

/** In the iOS app: status bar, notification taps, and this device's push token once a member is signed in. */
function NativeBridge() {
  const { member } = useStore()
  const session = useSession()
  useEffect(() => {
    startNative((hash) => {
      window.location.hash = hash
    })
  }, [])
  const uid = session?.user.id
  useEffect(() => {
    if (uid && member.role && !member.mustChange) void enablePush(uid)
  }, [uid, member.role, member.mustChange])
  return null
}

function Pages() {
  const { route, nonce } = useRouter()
  const { member } = useStore()
  // a «شاشة» account only drives the wall screen (public/screen/); the database gives it nothing else
  if (member.enabled && member.role === "screen") return <ScreenAccountNotice />
  switch (route.page) {
    case "library":
      return <LibraryPage key={nonce} section={route.section} />
    case "social":
      return <SocialPage key={nonce} />
    case "whatsapp":
      return <SocialPage key="whatsapp" mode="whatsapp" />
    case "calendar":
      return <CalendarPage key={nonce} />
    case "overview":
      return <HomePage key={nonce} />
    case "contacts":
      return <ContactsPage key={nonce} />
    case "transport":
      return <TransportPage key="transport" view={route.view} />
    case "csr":
      return <CsrPage key="csr" tab={route.tab} id={route.id} />
    case "members":
      return <MembersPage key={nonce} />
    default:
      return <LockedArea>{lockedPage(route, nonce)}</LockedArea>
  }
}

function lockedPage(route: ReturnType<typeof useRouter>["route"], nonce: number) {
  switch (route.page) {
    case "branch":
      return <BranchPage key={nonce} slug={route.slug} />
    case "sources":
      return <SourcesPage key={nonce} />
    case "remedial":
      return <RemedialPage key={nonce} slug={route.slug} />
    case "complaints":
      return <ComplaintsPage key={nonce} />
    case "pbx":
      return <PbxPage key={nonce} />
    case "pbx-branches":
      return <PbxPage key={nonce} tab="branches" />
    case "students":
      return <StudentsPage key={nonce} />
    case "display":
      return <DisplayPage key="display" />
    case "competitors":
      return <CompetitorsPage key={nonce} />
    case "builder":
      return <BuilderPage key={nonce} />
    default:
      return <IndicatorsHomePage key={nonce} />
  }
}

function ScreenAccountNotice() {
  return (
    <section className="mx-auto mt-12 max-w-lg rounded-2xl border bg-card p-8 text-center">
      <h1 className="text-[24px] font-bold">هذا الحساب مخصص لشاشة العرض</h1>
      <p className="mt-2 text-[16px] text-muted-foreground">حساب «شاشة عرض» يفتح شاشة أعداد الطلاب فقط، ولا يرى أقسام المنصة.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <a href="./screen/" className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90">فتح شاشة العرض</a>
        <button type="button" onClick={() => void signOut()} className="inline-flex h-11 items-center rounded-full border px-5 text-[15px] hover:bg-accent">تسجيل الخروج</button>
      </div>
    </section>
  )
}

export default function App() {
  return (
    <DirectionProvider dir="rtl">
      <RouterProvider>
        <DataProvider>
          <Shell>
            <Pages />
          </Shell>
          <ForcePasswordChange />
          <NativeBridge />
          <Toaster position="bottom-left" richColors={false} closeButton mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)" }} />
        </DataProvider>
      </RouterProvider>
    </DirectionProvider>
  )
}
