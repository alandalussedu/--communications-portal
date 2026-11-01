import type { ReactNode } from "react"
import { RefreshCw } from "lucide-react"
import { useStore } from "@/data/store"
import type { CollectionName } from "@/data/types"
import { Banner, EmptyState, LoadingBlock, Panel } from "./common"

/**
 * Wraps a page section with the connection lifecycle: loading, unavailable,
 * failed, empty. Children render only when the named collections have loaded.
 */
export function Gate({
  needs,
  children,
  emptyWhen,
  emptyTitle,
  emptyBody,
  loadingRows = 5,
}: {
  needs: CollectionName[]
  children: ReactNode
  emptyWhen?: boolean
  emptyTitle?: string
  emptyBody?: ReactNode
  loadingRows?: number
}) {
  const { connection, loaded, reconnect } = useStore()
  if (connection.kind === "unavailable")
    return (
      <Panel>
        <EmptyState title="تعذّر الوصول إلى بيانات المنصة" body={connection.reason} />
      </Panel>
    )
  if (connection.kind === "error" && !needs.every((n) => loaded[n]))
    return (
      <Banner
        tone="bad"
        title="فشل تحميل البيانات"
        action={
          <button
            type="button"
            onClick={reconnect}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-card px-3 text-[15px] text-foreground hover:bg-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            إعادة المحاولة
          </button>
        }
      >
        {connection.message}
      </Banner>
    )
  if (!needs.every((n) => loaded[n]))
    return (
      <Panel>
        <LoadingBlock rows={loadingRows} />
      </Panel>
    )
  if (emptyWhen)
    return (
      <Panel>
        <EmptyState
          title={emptyTitle ?? "لا توجد بيانات بعد"}
          body={emptyBody ?? "لم تُحمَّل سجلات في قاعدة بيانات المنصة حتى الآن."}
        />
      </Panel>
    )
  return <>{children}</>
}
