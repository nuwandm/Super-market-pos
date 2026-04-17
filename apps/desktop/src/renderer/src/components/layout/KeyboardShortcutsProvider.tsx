import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { useShortcutsStore, matchesShortcut } from '@/stores/shortcuts.store'

const NAV_ROUTES: Record<string, string> = {
  'nav.pos':        '/pos',
  'nav.dashboard':  '/dashboard',
  'nav.products':   '/products',
  'nav.categories': '/categories',
  'nav.inventory':  '/inventory',
  'nav.sales':      '/sales',
  'nav.customers':  '/customers',
  'nav.reports':    '/reports',
  'nav.settings':   '/settings',
}

/**
 * Global navigation + logout shortcuts, mounted inside AppShell (authenticated only).
 * Shortcut keys are user-configurable via Settings → Shortcuts.
 */
export default function KeyboardShortcutsProvider() {
  const navigate  = useNavigate()
  const logout    = useAuthStore((s) => s.logout)
  const shortcuts = useShortcutsStore((s) => s.shortcuts)

  useEffect(() => {
    function handleLogout() {
      logout()
      navigate('/login')
      toast.success('Logged out')
    }

    function handler(e: KeyboardEvent) {
      const tag     = (e.target as HTMLElement).tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA'

      for (const sc of shortcuts) {
        if (!matchesShortcut(e, sc.currentKey)) continue
        // Skip Ctrl/Alt shortcuts when user is typing in a text field
        if (inInput && sc.currentKey.includes('+')) continue

        const path = NAV_ROUTES[sc.id]
        if (path) {
          e.preventDefault()
          navigate(path)
          return
        }
        if (sc.id === 'nav.logout') {
          e.preventDefault()
          handleLogout()
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts, navigate, logout])

  return null
}
