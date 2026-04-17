import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Search, ArrowUpDown, History, RefreshCw,
  Package, AlertTriangle, TrendingDown, DollarSign, Download,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import type { StockMovement } from '@pos/shared-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ─── Types ────────────────────────────────────────────────────────────────────
// Flat shape returned by inventory:getAll IPC

interface InvRow {
  id: string
  branchId: string
  productId: string
  qtyOnHand: number
  qtyReserved: number
  lastCountedAt?: number | null
  updatedAt: number
  productName: string
  productSku: string
  productBarcode?: string | null
  sellingPrice: number
  costPrice: number
  reorderLevel: number
  categoryId?: string | null
  categoryName?: string | null
  unitAbbr?: string | null
}

type AdjType = 'adjustment_in' | 'adjustment_out' | 'wastage_out' | 'opening_stock'

interface AdjForm { qty: string; type: AdjType; reason: string }
const defaultAdj: AdjForm = { qty: '', type: 'adjustment_in', reason: '' }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stockStatus(item: InvRow): 'out' | 'low' | 'ok' {
  if (item.qtyOnHand <= 0) return 'out'
  if (item.qtyOnHand <= item.reorderLevel) return 'low'
  return 'ok'
}

const STATUS_BADGE: Record<string, { label: string; variant: 'destructive' | 'warning' | 'success' }> = {
  out: { label: 'Out of Stock', variant: 'destructive' },
  low: { label: 'Low Stock',    variant: 'warning' },
  ok:  { label: 'In Stock',     variant: 'success' },
}

const MOV_TYPE_META: Record<string, { label: string; color: string }> = {
  grn_in:         { label: 'GRN Received',     color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  sale_out:       { label: 'Sale',             color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  return_in:      { label: 'Return',           color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  adjustment_in:  { label: 'Adjustment In',    color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400' },
  adjustment_out: { label: 'Adjustment Out',   color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  wastage_out:    { label: 'Wastage/Damage',   color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  transfer_in:    { label: 'Transfer In',      color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400' },
  transfer_out:   { label: 'Transfer Out',     color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  opening_stock:  { label: 'Opening Stock',    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
}

const ADJ_OPTIONS: { value: AdjType; label: string; hint: string }[] = [
  { value: 'adjustment_in',  label: 'Add Stock',       hint: 'Purchased / found extra units' },
  { value: 'adjustment_out', label: 'Remove Stock',    hint: 'Correction / stock transferred out' },
  { value: 'wastage_out',    label: 'Wastage / Damage', hint: 'Expired, damaged or lost units' },
  { value: 'opening_stock',  label: 'Opening Stock',   hint: 'Set initial stock level' },
]

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary' }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { session, supermarket } = useAuthStore()
  const branchId = session?.branchId ?? ''
  const currency  = supermarket?.currency ?? 'LKR'

  const [inventory,   setInventory]   = useState<InvRow[]>([])
  const [movements,   setMovements]   = useState<StockMovement[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [statusTab,   setStatusTab]   = useState<'all' | 'low' | 'out'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [adjTarget,   setAdjTarget]   = useState<InvRow | null>(null)
  const [movTarget,   setMovTarget]   = useState<InvRow | null>(null)
  const [adjForm,     setAdjForm]     = useState<AdjForm>(defaultAdj)
  const [saving,      setSaving]      = useState(false)
  const [movLoading,  setMovLoading]  = useState(false)

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const res = await api.inventory.getAll(branchId)
      if (res.success) setInventory((res.data ?? []) as InvRow[])
    } catch { toast.error('Failed to load inventory') }
    finally { setLoading(false) }
  }, [branchId])

  useEffect(() => { load() }, [load])

  async function loadMovements(item: InvRow) {
    setMovTarget(item)
    setMovements([])
    setMovLoading(true)
    try {
      const res = await api.inventory.getMovements(item.productId, branchId)
      if (res.success) setMovements((res.data ?? []) as StockMovement[])
    } catch { toast.error('Failed to load movements') }
    finally { setMovLoading(false) }
  }

  async function adjust() {
    if (!adjTarget) return
    const qty = parseFloat(adjForm.qty)
    if (isNaN(qty) || qty <= 0) { toast.error('Enter a valid quantity'); return }
    if (!adjForm.reason.trim())  { toast.error('Reason is required'); return }
    setSaving(true)
    try {
      const res = await api.inventory.adjust(
        adjTarget.productId, qty, adjForm.type,
        adjForm.reason.trim(), session!.staffId, branchId
      )
      if (!res.success) { toast.error(res.error ?? 'Adjustment failed'); return }
      toast.success('Stock adjusted successfully')
      setAdjTarget(null)
      setAdjForm(defaultAdj)
      await load()
    } catch { toast.error('Adjustment failed') }
    finally { setSaving(false) }
  }

  // ── Derived stats ──────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const outCount  = inventory.filter((i) => i.qtyOnHand <= 0).length
    const lowCount  = inventory.filter((i) => i.qtyOnHand > 0 && i.qtyOnHand <= i.reorderLevel).length
    const stockValue = inventory.reduce((sum, i) => sum + i.qtyOnHand * i.costPrice, 0)
    return { total: inventory.length, outCount, lowCount, stockValue }
  }, [inventory])

  // ── Categories for filter ──────────────────────────────────────────────────

  const categories = useMemo(() => {
    const map = new Map<string, string>()
    inventory.forEach((i) => {
      if (i.categoryId && i.categoryName) map.set(i.categoryId, i.categoryName)
    })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [inventory])

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return inventory.filter((item) => {
      if (q && !item.productName.toLowerCase().includes(q) &&
          !item.productSku.toLowerCase().includes(q) &&
          !(item.productBarcode ?? '').includes(q)) return false
      if (statusTab === 'out' && item.qtyOnHand > 0) return false
      if (statusTab === 'low' && !(item.qtyOnHand > 0 && item.qtyOnHand <= item.reorderLevel)) return false
      if (categoryFilter !== 'all' && item.categoryId !== categoryFilter) return false
      return true
    })
  }, [inventory, search, statusTab, categoryFilter])

  // ── Adjustment preview qty ─────────────────────────────────────────────────

  const previewQty = useMemo(() => {
    if (!adjTarget) return null
    const qty = parseFloat(adjForm.qty)
    if (isNaN(qty) || qty <= 0) return null
    const change = adjForm.type.includes('out') ? -Math.abs(qty) : Math.abs(qty)
    return adjTarget.qtyOnHand + change
  }, [adjTarget, adjForm.qty, adjForm.type])

  function exportCSV() {
    const headers = ['Product Name', 'SKU', 'Barcode', 'Category', 'Unit', 'On Hand', 'Reorder Level', 'Cost Price', 'Selling Price', 'Status', 'Stock Value']
    const rows = inventory.map((i) => {
      const st = stockStatus(i)
      return [
        i.productName,
        i.productSku,
        i.productBarcode ?? '',
        i.categoryName ?? '',
        i.unitAbbr ?? '',
        i.qtyOnHand,
        i.reorderLevel,
        i.costPrice.toFixed(2),
        i.sellingPrice.toFixed(2),
        STATUS_BADGE[st].label,
        (i.qtyOnHand * i.costPrice).toFixed(2),
      ]
    })
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={inventory.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Package}
          label="Total SKUs"
          value={String(stats.total)}
          sub="active products tracked"
        />
        <StatCard
          icon={AlertTriangle}
          label="Out of Stock"
          value={String(stats.outCount)}
          sub="need immediate restocking"
          color="text-destructive"
        />
        <StatCard
          icon={TrendingDown}
          label="Low Stock"
          value={String(stats.lowCount)}
          sub="at or below reorder level"
          color="text-amber-600"
        />
        <StatCard
          icon={DollarSign}
          label="Stock Value"
          value={formatCurrency(stats.stockValue, currency)}
          sub="at cost price"
          color="text-green-600"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, SKU or barcode..."
            className="pl-8 h-9"
          />
        </div>

        {/* Status tabs */}
        <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as typeof statusTab)}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs">
              All
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                {inventory.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="low" className="text-xs">
              Low Stock
              {stats.lowCount > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-medium">
                  {stats.lowCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="out" className="text-xs">
              Out of Stock
              {stats.outCount > 0 && (
                <span className="ml-1.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 px-1.5 py-0.5 text-[10px] font-medium">
                  {stats.outCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Category filter */}
        {categories.length > 0 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_100px] gap-x-3 px-4 py-2 border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>Product</span>
          <span>Category</span>
          <span>SKU</span>
          <span className="text-right">Cost / Selling</span>
          <span className="text-right">On Hand</span>
          <span>Status</span>
          <span />
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {[1,2,3,4,5,6].map((i) => <div key={i} className="h-16 animate-pulse bg-card" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center text-sm text-muted-foreground">
            {search || statusTab !== 'all' || categoryFilter !== 'all'
              ? 'No items match your filters'
              : 'No inventory records yet'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((item) => {
              const st = stockStatus(item)
              const { label, variant } = STATUS_BADGE[st]
              const isLow = st === 'low'
              const isOut = st === 'out'
              return (
                <div
                  key={item.id}
                  className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_100px] gap-x-3 items-center px-4 py-3 ${
                    isOut ? 'bg-destructive/5' : isLow ? 'bg-amber-50/50 dark:bg-amber-900/5' : ''
                  }`}
                >
                  {/* Product name + barcode */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.productName}</p>
                    {item.productBarcode && (
                      <p className="text-xs text-muted-foreground font-mono">{item.productBarcode}</p>
                    )}
                  </div>

                  {/* Category */}
                  <p className="text-sm text-muted-foreground truncate">
                    {item.categoryName ?? '—'}
                  </p>

                  {/* SKU */}
                  <p className="text-sm font-mono text-muted-foreground">{item.productSku}</p>

                  {/* Cost / Selling */}
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground font-mono">{formatCurrency(item.costPrice, currency)}</p>
                    <p className="text-sm font-mono font-semibold">{formatCurrency(item.sellingPrice, currency)}</p>
                  </div>

                  {/* On hand */}
                  <div className="text-right">
                    <p className={`text-sm font-mono font-bold ${
                      isOut ? 'text-destructive' : isLow ? 'text-amber-600' : ''
                    }`}>
                      {item.qtyOnHand} {item.unitAbbr ?? ''}
                    </p>
                    {item.reorderLevel > 0 && (
                      <p className="text-xs text-muted-foreground font-mono">
                        reorder: {item.reorderLevel}
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <Badge variant={variant} className="w-fit text-[11px]">
                    {label}
                  </Badge>

                  {/* Actions */}
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Stock movements"
                      onClick={() => loadMovements(item)}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Adjust stock"
                      onClick={() => { setAdjTarget(item); setAdjForm(defaultAdj) }}
                    >
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
            Showing {filtered.length} of {inventory.length} products
          </div>
        )}
      </div>

      {/* ── Adjust Stock Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!adjTarget} onOpenChange={(o) => !o && setAdjTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Product info */}
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 space-y-1">
              <p className="text-sm font-semibold">{adjTarget?.productName}</p>
              <p className="text-xs text-muted-foreground font-mono">{adjTarget?.productSku}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">Current stock:</span>
                <span className="text-sm font-mono font-bold">
                  {adjTarget?.qtyOnHand ?? 0} {adjTarget?.unitAbbr ?? ''}
                </span>
              </div>
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>Adjustment Type</Label>
              <Select
                value={adjForm.type}
                onValueChange={(v) => setAdjForm((f) => ({ ...f, type: v as AdjType }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ADJ_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <div>
                        <p className="font-medium">{o.label}</p>
                        <p className="text-xs text-muted-foreground">{o.hint}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Qty */}
            <div className="space-y-1.5">
              <Label>Quantity {adjTarget?.unitAbbr ? `(${adjTarget.unitAbbr})` : ''}</Label>
              <Input
                type="number"
                min="0"
                step="0.001"
                value={adjForm.qty}
                onChange={(e) => setAdjForm((f) => ({ ...f, qty: e.target.value }))}
                placeholder="0"
                className="font-mono text-lg"
                autoFocus
              />
            </div>

            {/* New qty preview */}
            {previewQty !== null && (
              <div className={`rounded-lg px-4 py-2.5 flex items-center justify-between text-sm ${
                previewQty < 0
                  ? 'bg-destructive/10 border border-destructive/30'
                  : 'bg-primary/5 border border-primary/20'
              }`}>
                <span className="text-muted-foreground">New quantity will be</span>
                <span className={`font-mono font-bold text-base ${previewQty < 0 ? 'text-destructive' : ''}`}>
                  {previewQty.toFixed(previewQty % 1 === 0 ? 0 : 3)} {adjTarget?.unitAbbr ?? ''}
                </span>
              </div>
            )}
            {previewQty !== null && previewQty < 0 && (
              <p className="text-xs text-destructive">
                Warning: This adjustment will result in negative stock.
              </p>
            )}

            <Separator />

            {/* Reason */}
            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <Input
                value={adjForm.reason}
                onChange={(e) => setAdjForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Physical count correction, Supplier delivery..."
                onKeyDown={(e) => e.key === 'Enter' && adjust()}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjTarget(null)}>Cancel</Button>
            <Button onClick={adjust} disabled={saving}>
              {saving ? 'Saving...' : 'Apply Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Stock Movements Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!movTarget} onOpenChange={(o) => !o && setMovTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Stock History</DialogTitle>
          </DialogHeader>

          {/* Product summary in dialog */}
          {movTarget && (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{movTarget.productName}</p>
                <p className="text-xs text-muted-foreground font-mono">{movTarget.productSku}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Current stock</p>
                <p className="text-sm font-mono font-bold">
                  {movTarget.qtyOnHand} {movTarget.unitAbbr ?? ''}
                </p>
              </div>
            </div>
          )}

          <ScrollArea className="h-[420px]">
            {movLoading ? (
              <div className="space-y-0 divide-y divide-border">
                {[1,2,3,4,5].map((i) => <div key={i} className="h-16 animate-pulse bg-card" />)}
              </div>
            ) : movements.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No stock movements recorded yet
              </div>
            ) : (
              <div className="divide-y divide-border">
                {movements.map((m) => {
                  const meta = MOV_TYPE_META[m.type] ?? { label: m.type, color: 'bg-muted text-muted-foreground' }
                  const isPositive = m.qtyChange >= 0
                  return (
                    <div key={m.id} className="grid grid-cols-[1fr_auto] gap-x-4 items-center px-1 py-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.color}`}>
                            {meta.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(m.createdAt)}
                          </span>
                        </div>
                        {m.note && (
                          <p className="text-xs text-muted-foreground truncate">{m.note}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-mono text-sm font-bold ${isPositive ? 'text-green-600' : 'text-destructive'}`}>
                          {isPositive ? '+' : ''}{m.qtyChange}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {m.qtyBefore} → {m.qtyAfter}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

    </div>
  )
}
