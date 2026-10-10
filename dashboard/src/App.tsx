import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import DashboardPage from './pages/DashboardPage'
import LiveDataPage from './pages/LiveDataPage'
import MapViewPage from './pages/MapViewPage'
import ChartsPage from './pages/ChartsPage'
import AlertsPage from './pages/AlertsPage'
import DevicesPage from './pages/DevicesPage'
import ExportPage from './pages/ExportPage'
import SettingsPage from './pages/SettingsPage'
import { useSettings } from './store/settings'
import { useTelemetry } from './store/telemetry'
import { link } from './lib/link'

function useTelemetryRuntime() {
  const autoRefresh = useSettings((s) => s.autoRefresh)
  const refreshSec = useSettings((s) => s.refreshSec)
  const mode = useTelemetry((s) => s.conn.mode)
  const autoConnectLora = useSettings((s) => s.autoConnectLora)

  useEffect(() => {
    link.startAutoConnect()
    return () => link.stopAutoConnect()
  }, [])

  useEffect(() => {
    if (autoConnectLora) {
      link.resetUserDisconnected()
      void link.autoConnectLora()
    }
  }, [autoConnectLora])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => useTelemetry.getState().commitView(), mode === 'lora' ? 250 : refreshSec * 1000)
    return () => clearInterval(id)
  }, [autoRefresh, refreshSec, mode])

  useEffect(() => {
    const id = setInterval(() => useTelemetry.getState().checkLink(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
}

export default function App() {
  useTelemetryRuntime()
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="live" element={<LiveDataPage />} />
        <Route path="map" element={<MapViewPage />} />
        <Route path="charts" element={<ChartsPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="export" element={<ExportPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
