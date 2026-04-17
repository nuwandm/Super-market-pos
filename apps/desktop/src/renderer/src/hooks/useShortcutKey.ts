import { useEffect, useRef } from 'react'
import { useShortcutsStore, matchesShortcut } from '@/stores/shortcuts.store'

/**
 * Registers a keyboard handler for a named shortcut action.
 * Automatically re-registers when the user changes the shortcut key in settings.
 */
export function useShortcutKey(actionId: string, callback: () => void) {
  const currentKey  = useShortcutsStore(
    (s) => s.shortcuts.find((sc) => sc.id === actionId)?.currentKey ?? ''
  )
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!currentKey) return

    function handler(e: KeyboardEvent) {
      if (matchesShortcut(e, currentKey)) {
        e.preventDefault()
        callbackRef.current()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [actionId, currentKey])
}
