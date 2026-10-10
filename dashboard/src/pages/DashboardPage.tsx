import { useSettings } from '../store/settings'
import SnapshotDashboard from './SnapshotDashboard'
import OverviewDashboard from './OverviewDashboard'

export default function DashboardPage() {
  const layout = useSettings((s) => s.layout)
  return layout === 'overview' ? <OverviewDashboard /> : <SnapshotDashboard />
}
