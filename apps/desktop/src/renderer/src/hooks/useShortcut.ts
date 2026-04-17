import { useEffect } from 'react'

type Modifier = 'ctrl' | 'alt' | 'shift' | 'meta'

interface ShortcutOptions {
  key: string
  modifiers?: Modifier[]
  onTrigger: () => void
  enabled?: boolean
}

export function useShortcut({ key, modifiers = [], onTrigger, enabled = true }: ShortcutOptions) {
  useEffect(() => {
    if (!enabled) return

    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      // Don't fire when typing in inputs unless it's a function key or has modifier
      if (
        modifiers.length === 0 &&
        !key.startsWith('F') &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) return

      const keyMatches = e.key.toLowerCase() === key.toLowerCase()
      const ctrlOk  = modifiers.includes('ctrl')  ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey)
      const altOk   = modifiers.includes('alt')   ? e.altKey  : !e.altKey
      const shiftOk = modifiers.includes('shift') ? e.shiftKey : !e.shiftKey

      if (keyMatches && ctrlOk && altOk && shiftOk) {
        e.preventDefault()
        onTrigger()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [key, modifiers, onTrigger, enabled])
}
