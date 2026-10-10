import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useSettings } from '../../store/settings'
import { Toaster } from '../ui/Toast'

export default function AppShell() {
  const { pathname } = useLocation()
  const layout = useSettings((s) => s.layout)
  const isDashboard = pathname === '/'
  // The overview layout carries its own header with connection + clock, like the reference design
  const hideTopbar = isDashboard && layout === 'overview'

  return (
    <div className="flex h-full min-h-0">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {!hideTopbar && <Topbar showDate={!isDashboard} />}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1680px] px-5 py-5 xl:px-6">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  )
}
