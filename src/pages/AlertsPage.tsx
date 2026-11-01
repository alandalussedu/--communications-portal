import { useMemo } from "react"
import { useStore } from "@/data/store"
import { buildAlerts, isHandled } from "@/data/insights"
import { formatNumber } from "@/lib/format"
import { Gate } from "@/components/Gate"
import { AlertList } from "@/components/alerts"
import { PageHeader, Panel } from "@/components/common"

export function AlertsPage() {
  const { data } = useStore()
  const alerts = useMemo(() => buildAlerts(data), [data])
  const open = alerts.filter((a) => !isHandled(a, data.alertState)).length
  return (
    <>
      <PageHeader
        eyebrow="التنبيهات"
        title="مركز التنبيهات"
        description={
          open
            ? `${formatNumber(open)} تنبيهًا مفتوحًا يحتاج متابعة إدارة التواصل المؤسسي. يُعاد فتح التنبيه المُتابَع فقط إذا تغيّرت البيانات التي أطلقته.`
            : "لا تنبيهات مفتوحة. يُعاد فتح التنبيه المُتابَع فقط إذا تغيّرت البيانات التي أطلقته."
        }
      />
      <Gate needs={["branches", "indicators", "syncLog", "settings", "alertState", "meta"]} emptyWhen={data.branches.length === 0}>
        <Panel className="rise">
          <AlertList alerts={alerts} />
        </Panel>
      </Gate>
    </>
  )
}
