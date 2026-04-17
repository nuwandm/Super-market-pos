import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import KeyboardShortcutsProvider from './KeyboardShortcutsProvider'

export default function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <KeyboardShortcutsProvider />
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
