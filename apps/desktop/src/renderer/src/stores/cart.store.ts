import { create } from 'zustand'
import type { CartItem } from '@pos/shared-types'

interface CartState {
  items:       CartItem[]
  discount:    number
  discountType: 'percent' | 'fixed'
  customerId:  string | null
  note:        string

  addItem:      (item: CartItem) => void
  removeItem:   (productId: string) => void
  updateQty:    (productId: string, qty: number) => void
  setDiscount:  (amount: number, type: 'percent' | 'fixed') => void
  setCustomer:  (id: string | null) => void
  setNote:      (note: string) => void
  clear:        () => void
  restore:      (snapshot: { items: CartItem[]; discount: number; discountType: 'percent' | 'fixed'; customerId: string | null; note: string }) => void

  // Derived
  subtotal:     () => number
  discountAmt:  () => number
  taxAmount:    () => number
  total:        () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items:        [],
  discount:     0,
  discountType: 'percent',
  customerId:   null,
  note:         '',

  addItem: (item) => set((s) => {
    const existing = s.items.find((i) => i.productId === item.productId)
    if (existing) {
      return {
        items: s.items.map((i) =>
          i.productId === item.productId
            ? { ...i, qty: i.qty + item.qty, total: (i.qty + item.qty) * i.unitPrice }
            : i
        ),
      }
    }
    return { items: [...s.items, item] }
  }),

  removeItem: (productId) =>
    set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),

  updateQty: (productId, qty) =>
    set((s) => ({
      items:
        qty <= 0
          ? s.items.filter((i) => i.productId !== productId)
          : s.items.map((i) =>
              i.productId === productId
                ? { ...i, qty, total: qty * i.unitPrice }
                : i
            ),
    })),

  setDiscount:  (discount, discountType) => set({ discount, discountType }),
  setCustomer:  (customerId) => set({ customerId }),
  setNote:      (note) => set({ note }),
  clear:        () => set({ items: [], discount: 0, discountType: 'percent', customerId: null, note: '' }),
  restore:      (snapshot) => set(snapshot),

  subtotal:    () => get().items.reduce((sum, i) => sum + i.total, 0),
  discountAmt: () => {
    const s = get()
    const sub = s.subtotal()
    return s.discountType === 'percent'
      ? sub * (s.discount / 100)
      : Math.min(s.discount, sub)
  },
  taxAmount:   () => 0, // VAT calculated per item in Phase 1
  total:       () => {
    const s = get()
    return Math.max(0, s.subtotal() - s.discountAmt() + s.taxAmount())
  },
}))
