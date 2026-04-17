import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Eye, XCircle, Printer, CalendarIcon, X, RotateCcw } from 'lucide-react'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Sale } from '@pos/shared-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

// ─── DatePicker ───────────────────────────────────────────────────────────────

function DatePickerButton({
  date, onSelect, placeholder, align = 'start',
}: {
  date?: Date
  onSelect: (d?: Date) => void
  placeholder: string
  align?: 'start' | 'center' | 'end'
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-36 justify-start gap-2 text-left font-normal',
            !date && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          {date ? format(date, 'dd MMM yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => { onSelect(d); setOpen(false) }}
          initialFocus
          disabled={(d) => d > new Date()}
        />
      </PopoverContent>
    </Popover>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReturnItem {
  productId: string
  productName: string
  qty: number
  maxQty: number
  unitPrice: number
  costPrice: number
  total: number
  selected: boolean
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SalesHistoryPage() {
  const { session, supermarket } = useAuthStore()
  const branchId = session?.branchId ?? ''
  const staffId  = session?.staffId  ?? ''
  const currency  = supermarket?.currency ?? 'LKR'

  const [sales,        setSales]        = useState<Sale[]>([])
  const [loading,      setLoading]      = useState(true)
  const [detail,       setDetail]       = useState<Sale | null>(null)
  const [voidTarget,   setVoidTarget]   = useState<Sale | null>(null)
  const [voidReason,   setVoidReason]   = useState('')
  const [voiding,      setVoiding]      = useState(false)
  const [printing,     setPrinting]     = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom,     setDateFrom]     = useState<Date | undefined>(undefined)
  const [dateTo,       setDateTo]       = useState<Date | undefined>(undefined)

  // Return state
  const [returnSale,   setReturnSale]   = useState<Sale | null>(null)
  const [returnItems,  setReturnItems]  = useState<ReturnItem[]>([])
  const [returnReason, setReturnReason] = useState('')
  const [returning,    setReturning]    = useState(false)

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const filters: Record<string, unknown> = {}
      if (statusFilter !== 'all') filters.status = statusFilter
      if (dateFrom) filters.dateFrom = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate()).getTime()
      if (dateTo)   filters.dateTo   = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59, 999).getTime()
      const res = await api.sales.getHistory(branchId, filters)
      if (res.success) setSales(res.data ?? [])
    } catch { toast.error('Failed to load sales') }
    finally { setLoading(false) }
  }, [branchId, statusFilter, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  async function loadDetail(sale: Sale) {
    try {
      const res = await api.sales.getById(sale.id)
      setDetail(res.success ? res.data : sale)
    } catch { setDetail(sale) }
  }

  async function printReceipt(saleId: string) {
    setPrinting(true)
    try {
      const res = await api.receipt.print(saleId)
      if (!res.success) toast.error(res.error ?? 'Print failed')
    } catch { toast.error('Print failed') }
    finally { setPrinting(false) }
  }

  async function voidSale() {
    if (!voidTarget) return
    if (!voidReason.trim()) { toast.error('Void reason is required'); return }
    setVoiding(true)
    try {
      const res = await api.sales.void(voidTarget.id, voidReason.trim())
      if (!res.success) { toast.error(res.error ?? 'Failed to void'); return }
      toast.success(`Sale #${voidTarget.receiptNumber} voided`)
      setVoidTarget(null)
      setVoidReason('')
      await load()
    } catch { toast.error('Void failed') }
    finally { setVoiding(false) }
  }

  async function openReturnDialog(sale: Sale) {
    try {
      const res = await api.sales.getById(sale.id)
      const fullSale: Sale = res.success ? res.data : sale
      setReturnSale(fullSale)
      setReturnItems(
        (fullSale.items ?? []).map((item) => ({
          productId:   item.productId,
          productName: item.productName,
          qty:         item.qty,
          maxQty:      item.qty,
          unitPrice:   item.unitPrice,
          costPrice:   item.costPrice ?? 0,
          total:       item.total,
          selected:    true,
        }))
      )
      setReturnReason('')
    } catch { toast.error('Failed to load sale details') }
  }

  function updateReturnQty(idx: number, newQty: number) {
    setReturnItems((prev) => prev.map((ri, i) => {
      if (i !== idx) return ri
      const q = Math.max(0, Math.min(newQty, ri.maxQty))
      return { ...ri, qty: q, total: q * ri.unitPrice, selected: q > 0 }
    }))
  }

  function toggleReturnItem(idx: number, checked: boolean) {
    setReturnItems((prev) => prev.map((ri, i) => {
      if (i !== idx) return ri
      return { ...ri, selected: checked, qty: checked ? ri.maxQty : 0, total: checked ? ri.maxQty * ri.unitPrice : 0 }
    }))
  }

  const returnTotal = returnItems
    .filter((ri) => ri.selected && ri.qty > 0)
    .reduce((s, ri) => s + ri.total, 0)

  async function processReturn() {
    if (!returnSale) return
    if (!returnReason.trim()) { toast.error('Return reason is required'); return }
    const selectedItems = returnItems.filter((ri) => ri.selected && ri.qty > 0)
    if (selectedItems.length === 0) { toast.error('Select at least one item to return'); return }

    setReturning(true)
    try {
      const res = await api.sales.createReturn({
        originalSaleId: returnSale.id,
        branchId,
        staffId,
        reason: returnReason.trim(),
        items: selectedItems.map((ri) => ({
          productId:   ri.productId,
          productName: ri.productName,
          qty:         ri.qty,
          unitPrice:   ri.unitPrice,
          costPrice:   ri.costPrice,
          total:       ri.total,
        })),
      })
      if (!res.success) { toast.error(res.error ?? 'Return failed'); return }
      toast.success(`Return processed — ${res.data?.receiptNumber}`)
      setReturnSale(null)
      setReturnItems([])
      await load()
    } catch { toast.error('Return failed') }
    finally { setReturning(false) }
  }

  function statusVariant(status: string) {
    if (status === 'completed') return 'success'
    if (status === 'voided')    return 'destructive'
    if (status === 'returned')  return 'secondary'
    return 'outline'
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sales History</h1>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap rounded-xl border border-border bg-card px-4 py-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="voided">Voided</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">From</Label>
          <div className="flex items-center gap-1">
            <DatePickerButton date={dateFrom} onSelect={setDateFrom} placeholder="Pick date" />
            {dateFrom && (
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setDateFrom(undefined)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">To</Label>
          <div className="flex items-center gap-1">
            <DatePickerButton date={dateTo} onSelect={setDateTo} placeholder="Pick date" align="end" />
            {dateTo && (
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setDateTo(undefined)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-end gap-2 pb-0.5">
          <Button size="sm" onClick={load} className="h-9">
            Search
          </Button>
          {(statusFilter !== 'all' || dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" className="h-9" onClick={() => { setStatusFilter('all'); setDateFrom(undefined); setDateTo(undefined) }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_100px] gap-x-4 px-4 py-2 border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>Receipt #</span><span>Date & Time</span><span>Items</span>
          <span className="text-right">Total</span><span>Status</span><span />
        </div>
        {loading ? (
          <div className="divide-y divide-border">
            {[1,2,3,4].map((i) => <div key={i} className="h-14 animate-pulse bg-card" />)}
          </div>
        ) : sales.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No sales found</div>
        ) : (
          <div className="divide-y divide-border">
            {sales.map((sale) => (
              <div key={sale.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_100px] gap-x-4 items-center px-4 py-3">
                <p className="text-sm font-mono font-medium">#{sale.receiptNumber}</p>
                <p className="text-sm text-muted-foreground">{formatDateTime(sale.createdAt)}</p>
                <p className="text-sm text-muted-foreground">{sale.items?.length ?? '—'} items</p>
                <p className="text-sm font-mono font-semibold text-right">{formatCurrency(sale.total, currency)}</p>
                <Badge variant={statusVariant(sale.status)} className="capitalize w-fit">{sale.status}</Badge>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => loadDetail(sale)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {sale.status === 'completed' && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Process Return"
                        onClick={() => openReturnDialog(sale)}
                      >
                        <RotateCcw className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Void Sale"
                        onClick={() => { setVoidTarget(sale); setVoidReason('') }}
                      >
                        <XCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sale Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Receipt #{detail?.receiptNumber}</DialogTitle>
              {detail?.status === 'completed' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mr-8"
                  onClick={() => detail && printReceipt(detail.id)}
                  disabled={printing}
                >
                  <Printer className="h-4 w-4 mr-1.5" />
                  {printing ? 'Printing...' : 'Print'}
                </Button>
              )}
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {detail && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Date</div>
                  <div>{formatDateTime(detail.createdAt)}</div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="capitalize">{detail.status}</div>
                </div>
                <Separator />
                <div className="space-y-2">
                  {(detail.items ?? []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {item.qty} × {formatCurrency(item.unitPrice, currency)}
                        </p>
                      </div>
                      <p className="font-mono font-semibold">{formatCurrency(item.total, currency)}</p>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono">{formatCurrency(detail.subtotal, currency)}</span>
                  </div>
                  {detail.discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span className="font-mono">- {formatCurrency(detail.discountAmount, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span className="font-mono">{formatCurrency(detail.total, currency)}</span>
                  </div>
                </div>
                {(detail.payments ?? []).length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-1 text-sm">
                      {(detail.payments ?? []).map((pay) => (
                        <div key={pay.id} className="flex justify-between">
                          <span className="text-muted-foreground capitalize">{pay.method.replace('_', ' ')}</span>
                          <span className="font-mono">{formatCurrency(pay.amount, currency)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={!!returnSale} onOpenChange={(o) => !o && setReturnSale(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Process Return — #{returnSale?.receiptNumber}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[55vh]">
            <div className="space-y-3 pr-1">
              {returnItems.map((ri, idx) => (
                <div key={ri.productId} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <input
                    type="checkbox"
                    checked={ri.selected}
                    onChange={(e) => toggleReturnItem(idx, e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ri.productName}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {formatCurrency(ri.unitPrice, currency)} × max {ri.maxQty}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      min={0}
                      max={ri.maxQty}
                      value={ri.qty}
                      onChange={(e) => updateReturnQty(idx, Number(e.target.value))}
                      className="w-16 h-8 text-center text-sm"
                    />
                    <span className="text-sm font-mono w-24 text-right">
                      {formatCurrency(ri.total, currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="space-y-3 pt-1">
            <Separator />
            <div className="flex justify-between text-sm font-bold">
              <span>Refund Total</span>
              <span className="font-mono text-base">{formatCurrency(returnTotal, currency)}</span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Return Reason *</Label>
              <Input
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="e.g. Defective product, Customer changed mind"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setReturnSale(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={processReturn}
                disabled={returning || returnTotal <= 0}
              >
                {returning ? 'Processing...' : `Refund ${formatCurrency(returnTotal, currency)}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Void Confirm */}
      <AlertDialog open={!!voidTarget} onOpenChange={(o) => !o && setVoidTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Sale #{voidTarget?.receiptNumber}</AlertDialogTitle>
            <AlertDialogDescription>
              This will reverse the sale and restore stock. Enter a reason:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-2">
            <Input
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason for void"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={voidSale}
            >
              {voiding ? 'Voiding...' : 'Void Sale'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
