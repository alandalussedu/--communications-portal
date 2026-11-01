import { DirectionProvider } from "@radix-ui/react-direction"
import { Toaster } from "@/components/ui/sonner"
import { DataProvider } from "@/data/store"
import { RouterProvider, useRouter } from "@/lib/router"
import { Shell } from "@/components/Shell"
import { IndicatorsHomePage } from "@/pages/OverviewPage"
import { HomePage } from "@/pages/HomePage"
import { LockedArea } from "@/components/LockedArea"
import { ReportsPage } from "@/pages/ReportsPage"
import { BranchPage } from "@/pages/BranchPage"
import { LibraryPage } from "@/pages/LibraryPage"
import { SourcesPage } from "@/pages/SourcesPage"
import { BuilderPage } from "@/pages/BuilderPage"
import { AlertsPage } from "@/pages/AlertsPage"
import { SocialPage } from "@/pages/SocialPage"
import { RemedialPage } from "@/pages/RemedialPage"
import { CompetitorsPage } from "@/pages/CompetitorsPage"
import { CalendarPage } from "@/pages/CalendarPage"

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
    default:
      return <LockedArea>{lockedPage(route, nonce)}</LockedArea>
  }
}

function lockedPage(route: ReturnType<typeof useRouter>["route"], nonce: number) {
  switch (route.page) {
    case "reports":
      return <ReportsPage key={nonce} />
    case "branch":
      return <BranchPage key={nonce} slug={route.slug} />
    case "sources":
      return <SourcesPage key={nonce} />
    case "remedial":
      return <RemedialPage key={nonce} slug={route.slug} />
    case "competitors":
      return <CompetitorsPage key={nonce} />
    case "alerts":
      return <AlertsPage key={nonce} />
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
          <Toaster position="bottom-left" richColors={false} closeButton />
        </DataProvider>
      </RouterProvider>
    </DirectionProvider>
  )
}
