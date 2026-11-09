import { DirectionProvider } from "@radix-ui/react-direction"
import { Toaster } from "@/components/ui/sonner"
import { DataProvider } from "@/data/store"
import { RouterProvider, useRouter } from "@/lib/router"
import { Shell } from "@/components/Shell"
import { IndicatorsHomePage } from "@/pages/OverviewPage"
import { HomePage } from "@/pages/HomePage"
import { LockedArea } from "@/components/LockedArea"
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
  switch (route.page) {
    case "library":
      return <LibraryPage key={nonce} section={route.section} />
    case "social":
      return <SocialPage key={nonce} />
    case "calendar":
      return <CalendarPage key={nonce} />
    case "overview":
      return <HomePage key={nonce} />
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
    case "competitors":
      return <CompetitorsPage key={nonce} />
    case "builder":
      return <BuilderPage key={nonce} />
    default:
      return <IndicatorsHomePage key={nonce} />
  }
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
