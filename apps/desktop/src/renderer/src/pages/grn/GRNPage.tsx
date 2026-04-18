import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Search, Eye, Trash2, PackagePlus, CalendarIcon,
} from 'lucide-react'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { formatCurrency, formatDateTime, cn } from '@/lib/utils'
import type { GRN, GRNItem, Supplier } from '@pos/shared-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductRow {
  id: string; name: string; sku: string; barcode?: string | null
  costPrice: number; sellingPrice: number; unitAbbr?: string | null
}

interface LineItem {
  productId: string; productName: string; productSku: string
  unitAbbr: string; qtyOrdered: number; qtyReceived: number; unitCost: number
}

// ─── DatePicker ───────────────────────────────────────────────────────────────

function DatePickerButton({ date, onSelect }: { date?: Date; onSelect: (d?: Date) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn('h-9 w-full justify-start gap-2 text-left font-normal', !date && 'text-muted-foreground')}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          {date ? format(date, 'dd MMM yyyy') : 'Pick date'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => { onSelect(d); setOpen(false) }}
          disabled={(d) => d > new Date()}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GRNPage() {
  const { session, supermarket } = useAuthStore()
  const branchId = session?.branchId ?? ''
  const currency  = supermarket?.currency ?? 'LKR'

  const [grnList,    setGrnList]    = useState<GRN[]>([])
  const [suppliers,  setSuppliers]  = useState<Supplier[]>([])
  const [products,   setProducts]   = useState<ProductRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [detailGRN,  setDetailGRN]  = useState<(GRN & { items: GRNItem[] }) | null>(null)

  // Create dialog state
  const [createOpen,     setCreateOpen]     = useState(false)
  const [supplierId,     setSupplierId]     = useState('')
  const [invoiceNumber,  setInvoiceNumber]  = useState('')
  const [receivedDate,   setReceivedDate]   = useState<Date>(new Date())
  const [note,           setNote]           = useState('')
  const [updateCost,     setUpdateCost]     = useState(true)
  const [lines,          setLines]          = useState<LineItem[]>([])
  const [productSearch,  setProductSearch]  = useState('')
  const [saving,         setSaving]         = useState(false)

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const [gRes, sRes, pRes] = await Promise.all([
        api.grn.getAll(branchId),
        api.suppliers.getAll(branchId),
        api.products.getAll(branchId),
      ])
      if (gRes.success) setGrnList((gRes.data ?? []) as GRN[])
      if (sRes.success) setSuppliers((sRes.data ?? []) as Supplier[])
      if (pRes.success) setProducts((pRes.data ?? []) as ProductRow[])
    } catch { toast.error('Failed to load GRN data') }
    finally { setLoading(false) }
  }, [branchId])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setSupplierId('none'); setInvoiceNumber(''); setReceivedDate(new Date())
    setNote(''); setUpdateCost(true); setLines([]); setProductSearch('')
    setCreateOpen(true)
  }

  // Product search for adding lines
  const productResults = useMemo(() => {
    const q = productSearch.toLowerCase().trim()
    if (!q) return []
    const alreadyAdded = new Set(lines.map((l) => l.productId))
    return products
      .filter((p) => !alreadyAdded.has(p.id) && (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? '').includes(q)
      ))
      .slice(0, 8)
  }, [productSearch, products, lines])

  function addLine(p: ProductRow) {
    setLines((prev) => [...prev, {
      productId:   p.id,
      productName: p.name,
      productSku:  p.sku,
      unitAbbr:    p.unitAbbr ?? 'pcs',
      qtyOrdered:  0,
      qtyReceived: 0,
      unitCost:    p.costPrice,
    }])
    setProductSearch('')
  }

  function updateLine(idx: number, field: keyof LineItem, value: string | number) {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  const totalCost = useMemo(
    () => lines.reduce((sum, l) => sum + l.qtyReceived * l.unitCost, 0),
    [lines]
  )

  async function save() {
    if (lines.length === 0) { toast.error('Add at least one product'); return }
    const validLines = lines.filter((l) => l.qtyReceived > 0)
    if (validLines.length === 0) { toast.error('At least one item must have qty received > 0'); return }

    setSaving(true)
    try {
      const res = await api.grn.create({
        branchId,
        supplierId:      (supplierId && supplierId !== 'none') ? supplierId : undefined,
        invoiceNumber:   invoiceNumber.trim() || undefined,
        receivedAt:      receivedDate.getTime(),
        note:            note.trim() || undefined,
        staffId:         session!.staffId,
        updateCostPrice: updateCost,
        items:           validLines.map((l) => ({
          productId:   l.productId,
          qtyOrdered:  l.qtyOrdered,
          qtyReceived: l.qtyReceived,
          unitCost:    l.unitCost,
        })),
      } as never)

      if (!res.success) { toast.error(res.error ?? 'Failed to create GRN'); return }
      toast.success('GRN created — inventory updated')
      setCreateOpen(false)
      await load()
    } catch { toast.error('Failed to create GRN') }
    finally { setSaving(false) }
  }

  async function loadDetail(grn: GRN) {
    try {
      const res = await api.grn.getById(grn.id)
      if (res.success) setDetailGRN(res.data as GRN & { items: GRNItem[] })
    } catch { toast.error('Failed to load GRN details') }
  }

  const filtered = grnList.filter((g) => {
    const q = search.toLowerCase()
    return !q || (g.invoiceNumber ?? '').toLowerCase().includes(q) ||
      (g.supplierName ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Goods Received Notes</h1>
          <p className="text-sm text-muted-foreground">Record incoming stock from suppliers</p>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Invoice # or supplier..."
            className="pl-8"
          />
        </div>
        <Button onClick={openCreate}>
          <PackagePlus className="h-4 w-4 mr-2" /> New GRN
        </Button>
      </div>

      {/* GRN List */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_80px] gap-x-4 px-4 py-2 border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>GRN Date</span><span>Invoice #</span><span>Supplier</span>
          <span className="text-right">Total Cost</span><span>Status</span><span />
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {[1,2,3].map((i) => <div key={i} className="h-14 animate-pulse bg-card" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {search ? 'No GRNs match your search' : 'No GRNs yet. Create one when stock arrives.'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((g) => (
              <div key={g.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_80px] gap-x-4 items-center px-4 py-3">
                <p className="text-sm">{formatDateTime(g.receivedAt)}</p>
                <p className="text-sm font-mono">{g.invoiceNumber ?? '—'}</p>
                <p className="text-sm text-muted-foreground">{g.supplierName ?? 'No supplier'}</p>
                <p className="text-sm font-mono font-semibold text-right">
                  {formatCurrency(g.totalCost, currency)}
                </p>
                <Badge variant={g.status === 'received' ? 'success' : 'outline'} className="capitalize w-fit">
                  {g.status}
                </Badge>
                <div className="flex justify-end">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => loadDetail(g)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Create GRN Dialog ───────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>New Goods Received Note</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh]">
            <div className="space-y-5 p-1">
              {/* Header fields */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Supplier</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select supplier (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No supplier</SelectItem>
                      {suppliers.filter((s) => s.isActive).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Invoice Number</Label>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-2026-001"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Received Date</Label>
                  <DatePickerButton
                    date={receivedDate}
                    onSelect={(d) => d && setReceivedDate(d)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Note</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Update cost prices</p>
                    <p className="text-xs text-muted-foreground">Set product cost price to unit cost from this GRN</p>
                  </div>
                  <Switch checked={updateCost} onCheckedChange={setUpdateCost} />
                </div>
              </div>

              <Separator />

              {/* Product search */}
              <div className="space-y-2">
                <Label>Add Products</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search product by name, SKU or barcode..."
                    className="pl-8"
                  />
                </div>
                {productResults.length > 0 && (
                  <div className="rounded-lg border border-border bg-card shadow-md divide-y divide-border">
                    {productResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left"
                        onClick={() => addLine(p)}
                      >
                        <div>
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground ml-2 font-mono text-xs">{p.sku}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(p.costPrice, currency)} cost
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Lines table */}
              {lines.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_36px] gap-x-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <span>Product</span>
                    <span className="text-right">Ordered</span>
                    <span className="text-right">Received *</span>
                    <span className="text-right">Unit Cost *</span>
                    <span className="text-right">Total</span>
                    <span />
                  </div>
                  <div className="divide-y divide-border">
                    {lines.map((line, idx) => (
                      <div key={line.productId} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_36px] gap-x-2 items-center px-3 py-2">
                        <div>
                          <p className="text-sm font-medium truncate">{line.productName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{line.productSku} · {line.unitAbbr}</p>
                        </div>
                        <Input
                          type="number" min="0" step="1"
                          value={line.qtyOrdered || ''}
                          onChange={(e) => updateLine(idx, 'qtyOrdered', parseFloat(e.target.value) || 0)}
                          className="h-8 text-right font-mono text-sm"
                          placeholder="0"
                        />
                        <Input
                          type="number" min="0" step="0.001"
                          value={line.qtyReceived || ''}
                          onChange={(e) => updateLine(idx, 'qtyReceived', parseFloat(e.target.value) || 0)}
                          className="h-8 text-right font-mono text-sm"
                          placeholder="0"
                        />
                        <Input
                          type="number" min="0" step="0.01"
                          value={line.unitCost || ''}
                          onChange={(e) => updateLine(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                          className="h-8 text-right font-mono text-sm"
                          placeholder="0.00"
                        />
                        <p className="text-sm font-mono text-right">
                          {formatCurrency(line.qtyReceived * line.unitCost, currency)}
                        </p>
                        <Button
                          type="button" variant="ghost" size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeLine(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end items-center gap-2 px-3 py-2 border-t border-border bg-muted/30">
                    <span className="text-sm text-muted-foreground">Total Cost:</span>
                    <span className="text-base font-bold font-mono">{formatCurrency(totalCost, currency)}</span>
                  </div>
                </div>
              )}

              {lines.length === 0 && (
                <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  Search and add products above to create the GRN
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || lines.length === 0}>
              {saving ? 'Saving...' : `Create GRN (${lines.filter((l) => l.qtyReceived > 0).length} items)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── GRN Detail Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!detailGRN} onOpenChange={(o) => !o && setDetailGRN(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>GRN Details</DialogTitle>
          </DialogHeader>
          {detailGRN && (
            <ScrollArea className="max-h-[65vh]">
              <div className="space-y-4 pr-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm rounded-lg bg-muted/40 p-3">
                  <span className="text-muted-foreground">Invoice #</span>
                  <span className="font-mono">{detailGRN.invoiceNumber ?? '—'}</span>
                  <span className="text-muted-foreground">Supplier</span>
                  <span>{detailGRN.supplierName ?? 'No supplier'}</span>
                  <span className="text-muted-foreground">Date</span>
                  <span>{formatDateTime(detailGRN.receivedAt)}</span>
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="success" className="w-fit capitalize">{detailGRN.status}</Badge>
                  {detailGRN.note && <>
                    <span className="text-muted-foreground">Note</span>
                    <span>{detailGRN.note}</span>
                  </>}
                </div>
                <Separator />
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-x-4 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground uppercase">
                    <span>Product</span>
                    <span className="text-right">Received</span>
                    <span className="text-right">Unit Cost</span>
                    <span className="text-right">Total</span>
                  </div>
                  <div className="divide-y divide-border">
                    {(detailGRN.items ?? []).map((item) => (
                      <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-x-4 px-3 py-2 items-center">
                        <div>
                          <p className="text-sm font-medium">{item.productName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.productSku}</p>
                        </div>
                        <p className="text-sm font-mono text-right">
                          {item.qtyReceived} {item.unitAbbr}
                        </p>
                        <p className="text-sm font-mono text-right">{formatCurrency(item.unitCost, currency)}</p>
                        <p className="text-sm font-mono font-semibold text-right">{formatCurrency(item.totalCost, currency)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end items-center gap-2 px-3 py-2 border-t border-border bg-muted/30">
                    <span className="text-sm text-muted-foreground">Total:</span>
                    <span className="font-bold font-mono">{formatCurrency(detailGRN.totalCost, currency)}</span>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
