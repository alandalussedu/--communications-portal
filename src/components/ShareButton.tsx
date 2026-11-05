import { Share2 } from "lucide-react"
import { canShare, shareLink } from "@/lib/native"
import { cn } from "@/lib/utils"

/** The iOS share sheet (or the browser's own) for a library link. Hidden where sharing is not available. */
export function ShareButton({ title, url, className }: { title: string; url: string; className?: string }) {
  if (!canShare()) return null
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void shareLink(title, url)
      }}
      className={cn("inline-flex h-8 items-center gap-1 rounded-md px-2 text-[15px] text-muted-foreground hover:bg-accent hover:text-foreground", className)}
      aria-label={`مشاركة ${title}`}
      title="مشاركة"
    >
      <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
      <span>مشاركة</span>
    </button>
  )
}
