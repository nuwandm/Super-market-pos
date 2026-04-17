import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ShortcutCategory = 'Navigation' | 'POS'

export interface ShortcutDef {
  id: string
  label: string
  category: ShortcutCategory
  defaultKey: string
  currentKey: string
}

const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  // Navigation
  { id: 'nav.pos',        label: 'Go to POS',           category: 'Navigation', defaultKey: 'F1',     currentKey: 'F1'     },
  { id: 'nav.dashboard',  label: 'Go to Dashboard',     category: 'Navigation', defaultKey: 'F2',     currentKey: 'F2'     },
  { id: 'nav.products',   label: 'Go to Products',      category: 'Navigation', defaultKey: 'F3',     currentKey: 'F3'     },
  { id: 'nav.categories', label: 'Go to Categories',    category: 'Navigation', defaultKey: 'F4',     currentKey: 'F4'     },
  { id: 'nav.inventory',  label: 'Go to Inventory',     category: 'Navigation', defaultKey: 'F5',     currentKey: 'F5'     },
  { id: 'nav.sales',      label: 'Go to Sales History', category: 'Navigation', defaultKey: 'F6',     currentKey: 'F6'     },
  { id: 'nav.customers',  label: 'Go to Customers',     category: 'Navigation', defaultKey: 'F7',     currentKey: 'F7'     },
  { id: 'nav.reports',    label: 'Go to Reports',       category: 'Navigation', defaultKey: 'F8',     currentKey: 'F8'     },
  { id: 'nav.settings',   label: 'Go to Settings',      category: 'Navigation', defaultKey: 'F9',     currentKey: 'F9'     },
  { id: 'nav.logout',     label: 'Logout',              category: 'Navigation', defaultKey: 'Ctrl+L', currentKey: 'Ctrl+L' },
  // POS
  { id: 'pos.charge',    label: 'Charge / Open Payment', category: 'POS', defaultKey: 'F10',    currentKey: 'F10'    },
  { id: 'pos.clearCart', label: 'Clear Cart',            category: 'POS', defaultKey: 'F11',    currentKey: 'F11'    },
  { id: 'pos.newSale',   label: 'New Sale',              category: 'POS', defaultKey: 'F12',    currentKey: 'F12'    },
  { id: 'pos.print',     label: 'Print Receipt',         category: 'POS', defaultKey: 'Ctrl+P', currentKey: 'Ctrl+P' },
]

interface ShortcutsState {
  shortcuts:      ShortcutDef[]
  updateShortcut: (id: string, key: string) => void
  resetAll:       () => void
}

export const useShortcutsStore = create<ShortcutsState>()(
  persist(
    (set) => ({
      shortcuts: DEFAULT_SHORTCUTS,
      updateShortcut: (id, key) =>
        set((s) => ({
          shortcuts: s.shortcuts.map((sc) => sc.id === id ? { ...sc, currentKey: key } : sc),
        })),
      resetAll: () =>
        set({ shortcuts: DEFAULT_SHORTCUTS.map((sc) => ({ ...sc, currentKey: sc.defaultKey })) }),
    }),
    { name: 'pos-shortcuts' }
  )
)

/** Returns true if a KeyboardEvent matches a shortcut string like "F1" or "Ctrl+L" */
export function matchesShortcut(e: KeyboardEvent, shortcutKey: string): boolean {
  if (!shortcutKey) return false
  const parts = shortcutKey.split('+')
  const key   = parts[parts.length - 1]
  const ctrl  = parts.includes('Ctrl')
  const alt   = parts.includes('Alt')
  const shift = parts.includes('Shift')
  return e.key === key && e.ctrlKey === ctrl && e.altKey === alt && e.shiftKey === shift
}
