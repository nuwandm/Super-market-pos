import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Search, Trash2, Plus, Minus, CreditCard, X, ReceiptText, Printer, CheckCircle2, UserCheck, UserCircle, Clock, Play, LogOut } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { useCartStore } from '@/stores/cart.store'
import { useShortcutKey } from '@/hooks/useShortcutKey'
import { formatCurrency } from '@/lib/utils'
import type { Product, Category, CashSession } from '@pos/shared-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

interface SessionReport {
  session: CashSession
  totalSales: number
  totalTransactions: number
  totalDiscount: number
  totalTax: number
  cashSales: number
  cardSales: number
  mobileSales: number
  totalReturns: number
  returnCount: number
}

type PayMethod = 'cash' | 'card' | 'mobile_pay' | 'credit'

export default function POSPage() {
  const { session, supermarket } = useAuthStore()
  const branchId = session?.branchId ?? ''
  const currency  = supermarket?.currency ?? 'LKR'

  const cart       = useCartStore()
  const barcodeRef = useRef<HTMLInputElement>(null)

  const [products,   setProducts]   = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search,     setSearch]     = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [payDialog, setPayDialog]   = useState(false)
  const [payMethod, setPayMethod]   = useState<PayMethod>('cash')
  const [cashInput, setCashInput]   = useState('')
  const [processing,   setProcessing]   = useState(false)
  const [lastReceipt,  setLastReceipt]  = useState<string | null>(null)
  const [lastSaleId,   setLastSaleId]   = useState<string | null>(null)
  const [saleChange,   setSaleChange]   = useState(0)
  const [successDialog, setSuccessDialog] = useState(false)
  const [printing,     setPrinting]     = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')

  // Customer search
  const [customerSearch,  setCustomerSearch]  = useState('')
  const [customerResults, setCustomerResults] = useState<{ id: string; name: string; phone: string | null }[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null)
  const [selectedCustomerData, setSelectedCustomerData] = useState<{ creditBalance: number; creditLimit: number } | null>(null)

  // Cash session
  const [cashSession,        setCashSession]        = useState<CashSession | null>(null)
  const [openSessionDialog,  setOpenSessionDialog]  = useState(false)
  const [floatAmount,        setFloatAmount]        = useState('')
  const [sessionLoading,     setSessionLoading]     = useState(false)
  const [closeSessionDialog, setCloseSessionDialog] = useState(false)
  const [closingCash,        setClosingCash]        = useState('')
  const [closingSession,     setClosingSession]     = useState(false)
  const [eodReport,          setEodReport]          = useState<SessionReport | null>(null)

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  useShortcutKey('pos.charge', () => {
    if (cart.items.length > 0 && !payDialog && !successDialog) {
      setCashInput('')
      setPayMethod('cash')
      setPayDialog(true)
    }
  })
  useShortcutKey('pos.clearCart', () => {
    if (cart.items.length > 0) cart.clear()
  })
  useShortcutKey('pos.newSale', () => {
    if (successDialog) setSuccessDialog(false)
    else if (payDialog) setPayDialog(false)
  })
  useShortcutKey('pos.print', () => {
    if (lastSaleId && !printing) printReceipt()
  })
  // ──────────────────────────────────────────────────────────────────────────

  // Check for open cash session on mount
  useEffect(() => {
    if (!branchId || !session) return
    api.sales.getCurrentSession(session.staffId, branchId)
      .then((res) => { if (res.success) setCashSession(res.data ?? null) })
      .catch(() => { /* session check failure is non-fatal */ })
  }, [branchId, session])

  async function openCashSession() {
    const amount = parseFloat(floatAmount)
    if (isNaN(amount) || amount < 0) { toast.error('Enter a valid opening float'); return }
    setSessionLoading(true)
    try {
      const res = await api.sales.openSession(session!.staffId, branchId, amount)
      if (!res.success) { toast.error(res.error ?? 'Failed to open session'); return }
      setCashSession(res.data as CashSession)
      setOpenSessionDialog(false)
      setFloatAmount('')
      toast.success('Cash session opened')
    } catch { toast.error('Failed to open session') }
    finally { setSessionLoading(false) }
  }

  async function closeCashSession() {
    if (!cashSession) return
    const amount = parseFloat(closingCash)
    if (isNaN(amount) || amount < 0) { toast.error('Enter a valid closing cash amount'); return }
    setClosingSession(true)
    try {
      const res = await api.sales.closeSession(cashSession.id, amount)
      if (!res.success) { toast.error(res.error ?? 'Failed to close session'); return }
      const rptRes = await api.sales.getSessionReport(cashSession.id)
      if (rptRes.success) setEodReport(rptRes.data as SessionReport)
      setCashSession(null)
    } catch { toast.error('Failed to close session') }
    finally { setClosingSession(false) }
  }

  // Load products and categories
  const load = useCallback(async () => {
    if (!branchId) return
    try {
      const [pRes, cRes] = await Promise.all([
        api.products.getAll(branchId),
        api.categories.getAll(branchId),
      ])
      if (pRes.success)  setProducts(pRes.data  ?? [])
      if (cRes.success)  setCategories(cRes.data ?? [])
    } catch {
      toast.error('Failed to load products')
    }
  }, [branchId])

  useEffect(() => { load() }, [load])

  // Auto-focus barcode field
  useEffect(() => {
    barcodeRef.current?.focus()
  }, [])

  // Barcode scan handler
  async function handleBarcodeSubmit(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !barcodeInput.trim()) return
    const barcode = barcodeInput.trim()
    setBarcodeInput('')
    try {
      const res = await api.products.getByBarcode(barcode, branchId)
      if (!res.success || !res.data) {
        toast.error(`Barcode not found: ${barcode}`)
        return
      }
      addProductToCart(res.data)
    } catch {
      toast.error('Barcode lookup failed')
    }
  }

  function addProductToCart(product: Product) {
    if (!product.isActive) { toast.error('Product is inactive'); return }
    const qtyOnHand = product.qtyOnHand ?? 0
    const inCart = cart.items.find((i) => i.productId === product.id)
    const currentQty = inCart?.qty ?? 0
    if (qtyOnHand > 0 && currentQty >= qtyOnHand) {
      toast.error('Insufficient stock')
      return
    }
    cart.addItem({
      productId:      product.id,
      name:           product.name,
      sku:            product.sku,
      barcode:        product.barcode ?? null,
      qty:            1,
      unitPrice:      product.sellingPrice,
      costPrice:      product.costPrice,
      discountAmount: 0,
      taxAmount:      0,
      total:          product.sellingPrice,
      unitAbbr:       product.unit?.abbreviation ?? '',
    })
  }

  // Filtered products
  const filteredProducts = products.filter((p) => {
    if (!p.isActive) return false
    const matchCat = activeCategory === 'all' || p.categoryId === activeCategory
    const q = search.toLowerCase()
    const matchSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode ?? '').includes(q)
    return matchCat && matchSearch
  })

  // Payment
  const total     = cart.total()
  const cashPaid  = parseFloat(cashInput) || 0
  const change          = payMethod === 'cash' ? Math.max(0, cashPaid - total) : 0
  const creditAvailable = selectedCustomerData
    ? selectedCustomerData.creditBalance + selectedCustomerData.creditLimit
    : 0
  const cashValid = payMethod === 'cash'
    ? cashPaid >= total
    : payMethod === 'credit'
      ? creditAvailable >= total
      : true

  async function completeSale() {
    if (cart.items.length === 0) { toast.error('Cart is empty'); return }
    if (!cashValid) { toast.error('Insufficient cash amount'); return }
    setProcessing(true)
    try {
      const saleData = {
        branchId,
        staffId:        session!.staffId,
        customerId:     cart.customerId,
        subtotal:       cart.subtotal(),
        discountAmount: cart.discountAmt(),
        discountType:   cart.discountType,
        taxAmount:      cart.taxAmount(),
        total:          cart.total(),
        note:           cart.note,
        items: cart.items.map((i) => ({
          productId:      i.productId,
          productName:    i.name,
          barcode:        i.barcode ?? undefined,
          qty:            i.qty,
          unitPrice:      i.unitPrice,
          costPrice:      i.costPrice,
          discountAmount: i.discountAmount,
          taxAmount:      i.taxAmount,
          total:          i.total,
        })),
        payments: [
          {
            method: payMethod,
            amount: payMethod === 'cash' ? cashPaid : total,
          },
        ],
      }
      const res = await api.sales.create(saleData)
      if (!res.success) {
        toast.error(res.error ?? 'Failed to create sale')
        return
      }
      const receiptNum = res.data?.receiptNumber ?? null
      const saleId     = res.data?.id ?? null
      setLastReceipt(receiptNum)
      setLastSaleId(saleId)
      setSaleChange(payMethod === 'cash' ? Math.max(0, cashPaid - total) : 0)
      cart.clear()
      setSelectedCustomer(null)
      setSelectedCustomerData(null)
      setPayDialog(false)
      setCashInput('')
      setSuccessDialog(true)
    } catch {
      toast.error('Sale failed')
    } finally {
      setProcessing(false)
    }
  }

  async function handleCustomerSearch(val: string) {
    setCustomerSearch(val)
    if (!val.trim()) { setCustomerResults([]); return }
    try {
      const res = await api.customers.search(val.trim(), branchId)
      if (res.success) setCustomerResults((res.data ?? []).slice(0, 5) as { id: string; name: string; phone: string | null }[])
    } catch { /* ignore */ }
  }

  async function selectCustomer(c: { id: string; name: string; phone: string | null }) {
    cart.setCustomer(c.id)
    setSelectedCustomer({ id: c.id, name: c.name })
    setCustomerSearch('')
    setCustomerResults([])
    try {
      const res = await api.customers.getById(c.id)
      if (res.success && res.data) {
        const d = res.data as Record<string, unknown>
        setSelectedCustomerData({ creditBalance: Number(d.creditBalance ?? 0), creditLimit: Number(d.creditLimit ?? 0) })
      }
    } catch { /* non-fatal */ }
  }

  function clearCustomer() {
    cart.setCustomer(null)
    setSelectedCustomer(null)
    setSelectedCustomerData(null)
    setCustomerSearch('')
    setCustomerResults([])
  }

  async function printReceipt() {
    if (!lastSaleId) return
    setPrinting(true)
    try {
      const res = await api.receipt.print(lastSaleId)
      if (!res.success) toast.error(res.error ?? 'Print failed')
    } catch {
      toast.error('Print failed')
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* LEFT: Product browser */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-2 p-3 border-b border-border bg-card">
          <Input
            ref={barcodeRef}
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={handleBarcodeSubmit}
            placeholder="Scan barcode..."
            className="w-48 font-mono"
          />
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="pl-8"
            />
          </div>
          {lastReceipt && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ReceiptText className="h-3 w-3" />
              Last: #{lastReceipt}
            </div>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto">
          <button
            onClick={() => setActiveCategory('all')}
            className={`shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            All
          </button>
          {categories.filter((c) => c.isActive).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-3 gap-2 p-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addProductToCart(product)}
                className="group rounded-lg border border-border bg-card p-3 text-left transition-all hover:border-primary hover:shadow-sm active:scale-[0.98]"
              >
                <p className="text-sm font-medium line-clamp-2 leading-snug">{product.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{product.sku}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-primary">
                    {formatCurrency(product.sellingPrice, currency)}
                  </span>
                  {product.qtyOnHand !== undefined && product.qtyOnHand <= (product.reorderLevel ?? 0) && (
                    <Badge variant="warning" className="text-[10px] px-1">Low</Badge>
                  )}
                </div>
                {product.unit && (
                  <p className="text-xs text-muted-foreground">per {product.unit.abbreviation}</p>
                )}
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-3 py-16 text-center text-sm text-muted-foreground">
                No products found
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT: Cart */}
      <div className="flex w-80 shrink-0 flex-col border-l border-border bg-card">
        {/* Cart header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold">Cart</h2>
          <div className="flex items-center gap-2">
            {cashSession ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-green-600 hover:text-red-600 hover:bg-red-50 gap-1"
                onClick={() => { setClosingCash(''); setEodReport(null); setCloseSessionDialog(true) }}
                title="Close cash session"
              >
                <Clock className="h-3 w-3" />
                <span>Close Session</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                onClick={() => { setFloatAmount(''); setOpenSessionDialog(true) }}
              >
                <Play className="h-3 w-3 mr-1" />
                Open Session
              </Button>
            )}
            {cart.items.length > 0 && (
              <Button variant="ghost" size="sm" onClick={cart.clear} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Customer selector */}
        <div className="border-b border-border px-3 py-2">
          {selectedCustomer ? (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <UserCheck className="h-4 w-4 shrink-0 text-green-500" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{selectedCustomer.name}</p>
                  {selectedCustomerData && (
                    <p className={`text-[11px] font-mono ${selectedCustomerData.creditBalance < 0 ? 'text-red-500' : selectedCustomerData.creditBalance > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                      Credit: {selectedCustomerData.creditBalance < 0
                        ? `(${formatCurrency(Math.abs(selectedCustomerData.creditBalance), currency)})`
                        : formatCurrency(selectedCustomerData.creditBalance, currency)}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={clearCustomer}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <UserCircle className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                value={customerSearch}
                onChange={(e) => handleCustomerSearch(e.target.value)}
                placeholder="Search customer..."
                className="h-8 pl-8 text-xs"
              />
              {customerResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-44 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      className="w-full px-3 py-2 text-left hover:bg-accent transition-colors"
                      onClick={() => selectCustomer(c)}
                    >
                      <p className="text-xs font-medium">{c.name}</p>
                      {c.phone && <p className="text-[11px] text-muted-foreground font-mono">{c.phone}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cart items */}
        <ScrollArea className="flex-1">
          {cart.items.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              Cart is empty
            </div>
          ) : (
            <div className="divide-y divide-border">
              {cart.items.map((item) => (
                <div key={item.productId} className="px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium line-clamp-1">{item.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {formatCurrency(item.unitPrice, currency)} / {item.unitAbbr || 'unit'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground"
                      onClick={() => cart.removeItem(item.productId)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => cart.updateQty(item.productId, item.qty - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-mono font-medium">{item.qty}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => cart.updateQty(item.productId, item.qty + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="font-mono text-sm font-semibold">
                      {formatCurrency(item.total, currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Totals */}
        <div className="border-t border-border p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono">{formatCurrency(cart.subtotal(), currency)}</span>
          </div>
          {cart.discountAmt() > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span className="font-mono">- {formatCurrency(cart.discountAmt(), currency)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="font-mono text-primary">{formatCurrency(cart.total(), currency)}</span>
          </div>

          {!cashSession && (
            <p className="text-xs text-amber-600 text-center">
              Open a cash session to process sales
            </p>
          )}
          <Button
            className="w-full h-12 text-base mt-2"
            disabled={cart.items.length === 0 || !cashSession}
            onClick={() => { setCashInput(''); setPayMethod('cash'); setPayDialog(true) }}
          >
            <CreditCard className="h-5 w-5 mr-2" />
            Charge {formatCurrency(cart.total(), currency)}
          </Button>
        </div>
      </div>

      {/* Sale Success Dialog */}
      <Dialog open={successDialog} onOpenChange={(o) => !o && setSuccessDialog(false)}>
        <DialogContent
          className="max-w-xs text-center"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && lastSaleId && !printing) {
              e.preventDefault()
              printReceipt()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex flex-col items-center gap-3">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              Sale Complete!
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Receipt</p>
              <p className="font-mono font-bold text-lg">#{lastReceipt}</p>
            </div>
            {saleChange > 0 && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                <p className="text-xs text-muted-foreground">Change</p>
                <p className="font-mono font-bold text-xl text-green-600">
                  {formatCurrency(saleChange, currency)}
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={printReceipt}
              disabled={printing || !lastSaleId}
            >
              <Printer className="h-4 w-4 mr-2" />
              {printing ? 'Sending to printer...' : 'Print Receipt'}
            </Button>
            <Button className="w-full" onClick={() => setSuccessDialog(false)}>
              New Sale
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Open Session Dialog */}
      <Dialog open={openSessionDialog} onOpenChange={(o) => !o && setOpenSessionDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Open Cash Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Enter the opening float (cash in drawer) to start accepting sales.
            </p>
            <div className="space-y-1.5">
              <Label>Opening Float ({currency})</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={floatAmount}
                onChange={(e) => setFloatAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && openCashSession()}
                className="font-mono text-lg"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSessionDialog(false)}>Cancel</Button>
            <Button onClick={openCashSession} disabled={sessionLoading}>
              {sessionLoading ? 'Opening...' : 'Open Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Session / EOD Dialog */}
      <Dialog open={closeSessionDialog} onOpenChange={(o) => { if (!closingSession) { setCloseSessionDialog(o); if (!o) setEodReport(null) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {eodReport ? 'End of Day Report' : 'Close Cash Session'}
            </DialogTitle>
          </DialogHeader>

          {!eodReport ? (
            <>
              <div className="space-y-3 py-2">
                <p className="text-sm text-muted-foreground">
                  Count the cash in the drawer and enter the total below to close the session.
                </p>
                <div className="space-y-1.5">
                  <Label>Closing Cash ({currency})</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && closeCashSession()}
                    className="font-mono text-lg"
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCloseSessionDialog(false)}>Cancel</Button>
                <Button onClick={closeCashSession} disabled={closingSession}>
                  <LogOut className="h-4 w-4 mr-1.5" />
                  {closingSession ? 'Closing...' : 'Close Session'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-3 py-1">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm rounded-lg border border-border bg-muted/40 p-4">
                  <span className="text-muted-foreground">Opening Float</span>
                  <span className="font-mono text-right">{formatCurrency(eodReport.session.openingFloat, currency)}</span>
                  <span className="text-muted-foreground">Cash Sales</span>
                  <span className="font-mono text-right">{formatCurrency(eodReport.cashSales, currency)}</span>
                  <span className="text-muted-foreground">Card Sales</span>
                  <span className="font-mono text-right">{formatCurrency(eodReport.cardSales, currency)}</span>
                  <span className="text-muted-foreground">Mobile Sales</span>
                  <span className="font-mono text-right">{formatCurrency(eodReport.mobileSales, currency)}</span>
                  {eodReport.totalReturns > 0 && (
                    <>
                      <span className="text-muted-foreground text-red-500">Returns ({eodReport.returnCount})</span>
                      <span className="font-mono text-right text-red-500">- {formatCurrency(eodReport.totalReturns, currency)}</span>
                    </>
                  )}
                  <Separator className="col-span-2" />
                  <span className="font-semibold">Total Sales</span>
                  <span className="font-mono font-bold text-right text-primary">{formatCurrency(eodReport.totalSales, currency)}</span>
                  <span className="text-muted-foreground">Transactions</span>
                  <span className="font-mono text-right">{eodReport.totalTransactions}</span>
                  <span className="text-muted-foreground">Expected Cash</span>
                  <span className="font-mono text-right">{formatCurrency(eodReport.session.expectedCash ?? 0, currency)}</span>
                  <span className="text-muted-foreground">Actual Cash</span>
                  <span className="font-mono text-right">{formatCurrency(eodReport.session.closingCash ?? 0, currency)}</span>
                  {eodReport.session.cashVariance != null && (
                    <>
                      <span className={`font-semibold ${(eodReport.session.cashVariance ?? 0) < 0 ? 'text-red-500' : 'text-green-600'}`}>Variance</span>
                      <span className={`font-mono font-bold text-right ${(eodReport.session.cashVariance ?? 0) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {(eodReport.session.cashVariance ?? 0) >= 0 ? '+' : ''}{formatCurrency(eodReport.session.cashVariance ?? 0, currency)}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button className="w-full" onClick={() => { setCloseSessionDialog(false); setEodReport(null) }}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={payDialog} onOpenChange={(o) => { if (!processing) setPayDialog(o) }}>
        <DialogContent
          className="max-w-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !processing && cashValid) {
              e.preventDefault()
              completeSale()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Payment</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Amount due */}
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-sm text-muted-foreground">Amount Due</p>
              <p className="text-3xl font-bold font-mono text-primary">
                {formatCurrency(total, currency)}
              </p>
            </div>

            {/* Payment method */}
            <div className="grid grid-cols-2 gap-2">
              {(['cash', 'card', 'mobile_pay'] as PayMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  className={`rounded-lg border-2 py-2 px-3 text-sm font-medium transition-colors ${
                    payMethod === m
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  {m === 'mobile_pay' ? 'Mobile' : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
              <button
                onClick={() => setPayMethod('credit')}
                disabled={!selectedCustomer}
                className={`rounded-lg border-2 py-2 px-3 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  payMethod === 'credit'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                Credit
              </button>
            </div>

            {/* Credit info preview */}
            {payMethod === 'credit' && selectedCustomerData && (
              <div className={`rounded-lg p-3 space-y-1.5 text-xs ${creditAvailable < total ? 'bg-red-50 border border-red-200' : 'bg-muted/50'}`}>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Wallet Balance</span>
                  <span className={`font-mono font-semibold ${selectedCustomerData.creditBalance < 0 ? 'text-red-500' : selectedCustomerData.creditBalance > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {formatCurrency(selectedCustomerData.creditBalance, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credit Limit</span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatCurrency(selectedCustomerData.creditLimit, currency)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-1">
                  <span className="font-medium">Available Credit</span>
                  <span className={`font-mono font-bold ${creditAvailable < total ? 'text-red-500' : 'text-green-600'}`}>
                    {formatCurrency(creditAvailable, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">After This Sale</span>
                  <span className={`font-mono font-semibold ${selectedCustomerData.creditBalance - total < -(selectedCustomerData.creditLimit) ? 'text-red-500' : 'text-green-600'}`}>
                    {formatCurrency(selectedCustomerData.creditBalance - total, currency)}
                  </span>
                </div>
                {creditAvailable < total && (
                  <p className="text-red-500 text-[11px] pt-0.5">
                    Insufficient credit. Top up wallet or increase credit limit in Customers.
                  </p>
                )}
              </div>
            )}

            {/* Cash input */}
            {payMethod === 'cash' && (
              <div className="space-y-1.5">
                <Label>Cash Received ({currency})</Label>
                <Input
                  type="number"
                  min={total}
                  step="0.01"
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && cashValid && !processing) { e.preventDefault(); completeSale() } }}
                  placeholder={total.toFixed(2)}
                  className="font-mono text-xl text-center h-12"
                  autoFocus
                />
                {cashPaid >= total && cashPaid > 0 && (
                  <div className="flex justify-between text-sm text-green-600 font-medium">
                    <span>Change</span>
                    <span className="font-mono">{formatCurrency(change, currency)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(false)} disabled={processing}>
              Cancel
            </Button>
            <Button
              onClick={completeSale}
              disabled={processing || !cashValid}
              className="min-w-24"
            >
              {processing ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
