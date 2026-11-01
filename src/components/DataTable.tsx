import { useMemo, useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

export type Column<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Value used for sorting. Leave out to make the column unsortable. */
  sort?: (row: T) => string | number | null
  className?: string
  headClassName?: string
}

type SortState = { key: string; dir: "asc" | "desc" } | null

const collator = new Intl.Collator("ar")

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  rowLabel,
  initialSort = null,
  empty,
  caption,
  stickyFirst = false,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (r: T) => string
  onRowClick?: (r: T) => void
  rowLabel?: (r: T) => string
  initialSort?: SortState
  empty?: ReactNode
  caption: string
  stickyFirst?: boolean
}) {
  const [sort, setSort] = useState<SortState>(initialSort)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sort) return rows
    const get = col.sort
    const out = [...rows].sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      if (va === null || va === undefined) return 1
      if (vb === null || vb === undefined) return -1
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : collator.compare(String(va), String(vb))
      return sort.dir === "asc" ? cmp : -cmp
    })
    return out
  }, [rows, columns, sort])

  const toggle = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null))

  if (rows.length === 0 && empty) return <>{empty}</>

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[16px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b bg-muted/60">
            {columns.map((c, i) => {
              const active = sort?.key === c.key
              const aria = active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={c.sort ? aria : undefined}
                  className={cn(
                    "whitespace-nowrap px-4 py-2.5 text-start text-[14px] font-medium text-muted-foreground",
                    stickyFirst && i === 0 && "sticky start-0 z-[1] bg-muted",
                    c.headClassName,
                  )}
                >
                  {c.sort ? (
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-1 -mx-1 hover:text-foreground",
                        active && "text-foreground",
                      )}
                    >
                      {c.header}
                      {active ? (
                        sort!.dir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        onRowClick(r)
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              aria-label={onRowClick && rowLabel ? rowLabel(r) : undefined}
              className={cn(
                "group border-b last:border-b-0",
                onRowClick && "cursor-pointer hover:bg-accent/60 focus-visible:bg-accent/60",
              )}
            >
              {columns.map((c, i) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-4 py-3 align-middle",
                    stickyFirst && i === 0 && "sticky start-0 z-[1] bg-card group-hover:bg-accent",
                    c.className,
                  )}
                >
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
