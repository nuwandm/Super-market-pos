import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search, RefreshCw, Printer, CalendarIcon, Tags, Upload, Download } from 'lucide-react'
import JsBarcode from 'jsbarcode'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { formatCurrency, cn } from '@/lib/utils'
import type { Product, Category, Unit } from '@pos/shared-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

// ─── EAN-13 helpers ───────────────────────────────────────────────────────────

function calcEAN13Check(digits12: string): number {
  const d = digits12.split('').map(Number)
  const sum = d.reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 1 : 3), 0)
  return (10 - (sum % 10)) % 10
}

function generateEAN13(): string {
  // 479 = Sri Lanka GS1 prefix
  const mid = String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, '0')
  const base = '479' + mid
  return base + calcEAN13Check(base)
}

function isValidEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false
  return calcEAN13Check(code.slice(0, 12)) === Number(code[12])
}

interface FormState {
  name: string
  nameSinhala: string
  nameTamil: string
  sku: string
  barcode: string
  categoryId: string
  unitId: string
  costPrice: string
  sellingPrice: string
  wholesalePrice: string
  taxType: 'vat' | 'exempt'
  reorderLevel: string
  reorderQty: string
  hasExpiry: boolean
  expiryDate: string   // 'YYYY-MM-DD' or ''
  isActive: boolean
  description: string
}

const defaultForm: FormState = {
  name: '', nameSinhala: '', nameTamil: '', sku: '', barcode: '',
  categoryId: '', unitId: '', costPrice: '0', sellingPrice: '0',
  wholesalePrice: '', taxType: 'vat', reorderLevel: '0', reorderQty: '0',
  hasExpiry: false, expiryDate: '', isActive: true, description: '',
}

// ─── BarcodePreview ───────────────────────────────────────────────────────────
// Extracted into its own component so the useEffect runs on mount (when the
// SVG is guaranteed to be in the DOM), not on the parent's render cycle.

function BarcodePreview({ barcode, name, price, currency }: {
  barcode: string
  name: string
  price: string
  currency: string
}) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!ref.current) return
    try {
      const format = isValidEAN13(barcode) ? 'EAN13' : 'CODE128'
      JsBarcode(ref.current, barcode, {
        format, width: 2, height: 60, displayValue: true,
        fontSize: 12, margin: 8, background: '#ffffff', lineColor: '#000000',
      })
    } catch {
      if (ref.current) ref.current.innerHTML = ''
    }
  }, [barcode])

  function printLabel() {
    if (!ref.current) return
    const svgHtml = ref.current.outerHTML
    const priceStr = price ? `${currency} ${parseFloat(price).toFixed(2)}` : ''
    const html = `<!DOCTYPE html>
<html><head><title>Barcode Label</title>
<style>body{margin:0;padding:12px;font-family:sans-serif;text-align:center}
.name{font-size:13px;font-weight:700;margin:0 0 4px}
.price{font-size:15px;font-weight:800;margin:0 0 4px}
@media print{body{padding:6px}}</style></head>
<body><p class="name">${name || 'Product'}</p>${priceStr ? `<p class="price">${priceStr}</p>` : ''}${svgHtml}</body></html>`
    const iframe = document.createElement('iframe')
    Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow?.document
    if (!doc) { document.body.removeChild(iframe); return }
    doc.open(); doc.write(html); doc.close()
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => document.body.removeChild(iframe), 1000)
  }

  return (
    <div className="mt-1 p-3 bg-white rounded-md border border-border flex flex-col items-center gap-2">
      <svg ref={ref} />
      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={printLabel}>
        <Printer className="h-3.5 w-3.5 mr-1.5" />
        Print Label
      </Button>
    </div>
  )
}

// ─── DatePickerButton ─────────────────────────────────────────────────────────

function DatePickerButton({
  date, onSelect, placeholder, disabled,
}: {
  date?: Date
  onSelect: (d?: Date) => void
  placeholder: string
  disabled?: (d: Date) => boolean
}) {
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
          {date ? format(date, 'dd MMM yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => { onSelect(d); setOpen(false) }}
          disabled={disabled}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export default function ProductsPage() {
  const { session, supermarket } = useAuthStore()
  const branchId = session?.branchId ?? ''
  const currency  = supermarket?.currency ?? 'LKR'

  const [products,   setProducts]   = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [units,      setUnits]      = useState<Unit[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [dialog,     setDialog]     = useState<'create' | 'edit' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [editing,    setEditing]    = useState<Product | null>(null)
  const [form,       setForm]       = useState<FormState>(defaultForm)
  const [saving,     setSaving]     = useState(false)
  const [batchTarget, setBatchTarget] = useState<Product | null>(null)
  const [batchQty,    setBatchQty]    = useState('1')

  // CSV Import
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importDialog, setImportDialog] = useState(false)
  const [importing,    setImporting]    = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)

  function printBatchLabels() {
    if (!batchTarget?.barcode) return
    const qty = parseInt(batchQty) || 1
    const clamped = Math.min(Math.max(qty, 1), 200)
    const svgContainer = document.createElement('div')
    svgContainer.style.display = 'none'
    document.body.appendChild(svgContainer)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svgContainer.appendChild(svg)
    try {
      const fmt = isValidEAN13(batchTarget.barcode) ? 'EAN13' : 'CODE128'
      JsBarcode(svg, batchTarget.barcode, { format: fmt, width: 2, height: 60, displayValue: true, fontSize: 12, margin: 8, background: '#ffffff', lineColor: '#000000' })
      const svgHtml = svg.outerHTML
      const priceStr = `${currency} ${batchTarget.sellingPrice.toFixed(2)}`
      const labelHtml = `<div style="display:inline-block;text-align:center;padding:8px;border:1px solid #ddd;margin:4px;page-break-inside:avoid">
        <p style="margin:0 0 3px;font-size:12px;font-weight:700">${batchTarget.name}</p>
        <p style="margin:0 0 3px;font-size:13px;font-weight:800">${priceStr}</p>
        ${svgHtml}
      </div>`
      const html = `<!DOCTYPE html><html><head><title>Barcode Labels</title>
      <style>body{margin:8px;font-family:sans-serif}@media print{body{margin:4px}}</style></head>
      <body>${labelHtml.repeat(clamped)}</body></html>`
      const iframe = document.createElement('iframe')
      Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
      document.body.appendChild(iframe)
      const doc = iframe.contentWindow?.document
      if (doc) { doc.open(); doc.write(html); doc.close(); iframe.contentWindow?.focus(); iframe.contentWindow?.print() }
      setTimeout(() => { document.body.removeChild(iframe); document.body.removeChild(svgContainer) }, 1500)
    } catch { document.body.removeChild(svgContainer) }
    setBatchTarget(null)
  }

  function generateBarcode() {
    // If editing a product that already has a barcode saved in the DB,
    // warn that the old barcode will be kept as an alternate (old labels still scan).
    if (dialog === 'edit' && editing?.barcode && form.barcode.trim() === editing.barcode) {
      toast.info('Old barcode will be kept as an alternate — existing labels still scan', { duration: 4000 })
    }
    field('barcode')(generateEAN13())
  }

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const [pRes, cRes, uRes] = await Promise.all([
        api.products.getAll(branchId),
        api.categories.getAll(branchId),
        api.settings.getUnits(branchId),
      ])
      if (pRes.success) setProducts(pRes.data ?? [])
      if (cRes.success) setCategories(cRes.data ?? [])
      if (uRes.success) setUnits(uRes.data ?? [])
    } catch { toast.error('Failed to load products') }
    finally { setLoading(false) }
  }, [branchId])

  useEffect(() => { load() }, [load])

  function field<K extends keyof FormState>(key: K) {
    return (v: FormState[K]) => setForm((f) => ({ ...f, [key]: v }))
  }

  function openCreate() {
    setEditing(null)
    setForm(defaultForm)
    setDialog('create')
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      name:          p.name,
      nameSinhala:   p.nameSinhala  ?? '',
      nameTamil:     p.nameTamil    ?? '',
      sku:           p.sku,
      barcode:       p.barcode      ?? '',
      categoryId:    p.categoryId,
      unitId:        p.unitId,
      costPrice:     String(p.costPrice),
      sellingPrice:  String(p.sellingPrice),
      wholesalePrice:p.wholesalePrice != null ? String(p.wholesalePrice) : '',
      taxType:       p.taxType,
      reorderLevel:  String(p.reorderLevel),
      reorderQty:    String(p.reorderQty),
      hasExpiry:     p.hasExpiry,
      expiryDate:    p.expiryDate ? new Date(p.expiryDate).toISOString().split('T')[0] : '',
      isActive:      p.isActive,
      description:   p.description  ?? '',
    })
    setDialog('edit')
  }

  async function save() {
    if (!form.name.trim())        { toast.error('Name is required');     return }
    if (!form.sku.trim())         { toast.error('SKU is required');      return }
    if (!form.categoryId)         { toast.error('Category is required'); return }
    if (!form.unitId)             { toast.error('Unit is required');     return }
    const sellingPrice = parseFloat(form.sellingPrice)
    if (isNaN(sellingPrice) || sellingPrice < 0) { toast.error('Invalid selling price'); return }

    setSaving(true)
    try {
      const data = {
        branchId,
        name:           form.name.trim(),
        nameSinhala:    form.nameSinhala || null,
        nameTamil:      form.nameTamil   || null,
        sku:            form.sku.trim().toUpperCase(),
        barcode:        form.barcode.trim() || null,
        categoryId:     form.categoryId,
        unitId:         form.unitId,
        costPrice:      parseFloat(form.costPrice)  || 0,
        sellingPrice,
        wholesalePrice: form.wholesalePrice ? parseFloat(form.wholesalePrice) : null,
        taxType:        form.taxType,
        reorderLevel:   parseFloat(form.reorderLevel) || 0,
        reorderQty:     parseFloat(form.reorderQty)   || 0,
        hasExpiry:      form.hasExpiry,
        expiryDate:     form.hasExpiry && form.expiryDate ? new Date(form.expiryDate).getTime() : null,
        isActive:       form.isActive,
        description:    form.description || null,
      }
      const res = dialog === 'create'
        ? await api.products.create(data)
        : await api.products.update(editing!.id, data)
      if (!res.success) { toast.error(res.error ?? 'Failed to save'); return }
      toast.success(dialog === 'create' ? 'Product created' : 'Product updated')
      setDialog(null)
      await load()
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  async function deleteProduct() {
    if (!deleteTarget) return
    try {
      const res = await api.products.delete(deleteTarget.id)
      if (!res.success) { toast.error(res.error ?? 'Failed to delete'); return }
      toast.success('Product deleted')
      setDeleteTarget(null)
      await load()
    } catch { toast.error('Delete failed') }
  }

  function downloadCsvTemplate() {
    const headers = 'name,sku,barcode,category,unit,cost_price,selling_price,reorder_level,description'
    const example = 'Example Product,SKU001,4790123456789,Beverages,pcs,50.00,100.00,10,optional description'
    const csv = [headers, example].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'products_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportResult(null)
    setImporting(true)
    setImportDialog(true)
    try {
      const text = await file.text()
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
      if (lines.length < 2) { toast.error('CSV is empty or missing data rows'); setImporting(false); return }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(',')
        const obj: Record<string, string> = {}
        headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim() })
        return obj
      })

      const res = await api.products.bulkImport(rows, branchId)
      if (res.success) {
        setImportResult(res.data as { imported: number; skipped: number; errors: string[] })
        await load()
      } else {
        toast.error(res.error ?? 'Import failed')
      }
    } catch { toast.error('Failed to read CSV file') }
    finally { setImporting(false) }
  }

  const filtered = products.filter((p) => {
    const q = search.toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode ?? '').includes(q)
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Products</h1>
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU, barcode..."
              className="pl-8"
            />
          </div>
        </div>
        <Button variant="outline" onClick={downloadCsvTemplate} title="Download CSV template">
          <Download className="h-4 w-4 mr-2" /> Template
        </Button>
        <Button variant="outline" onClick={() => importInputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-2" /> Import CSV
        </Button>
        <input
          ref={importInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleCsvImport}
        />
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add Product
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_110px] gap-x-4 px-4 py-2 border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>Product</span><span>SKU</span><span>Category</span>
          <span className="text-right">Selling Price</span><span>Status</span><span />
        </div>
        {loading ? (
          <div className="space-y-0 divide-y divide-border">
            {[1,2,3,4].map((i) => <div key={i} className="h-14 bg-card animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {search ? 'No products match your search' : 'No products yet. Add one to get started.'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((p) => (
              <div key={p.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_110px] gap-x-4 items-center px-4 py-3">
                <div>
                  <p className="text-sm font-medium line-clamp-1">{p.name}</p>
                  {p.barcode && <p className="text-xs text-muted-foreground font-mono">{p.barcode}</p>}
                </div>
                <p className="text-sm font-mono">{p.sku}</p>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {categories.find((c) => c.id === p.categoryId)?.name ?? '—'}
                </p>
                <p className="text-sm font-mono font-medium text-right">
                  {formatCurrency(p.sellingPrice, currency)}
                </p>
                <Badge variant={p.isActive ? 'success' : 'outline'}>
                  {p.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <div className="flex justify-end gap-1">
                  {p.barcode && (
                    <Button variant="ghost" size="icon" title="Print labels" onClick={() => { setBatchTarget(p); setBatchQty('1') }}>
                      <Tags className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(p)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{dialog === 'create' ? 'New Product' : 'Edit Product'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh]">
            <div className="grid grid-cols-3 gap-4 p-1">
              {/* Name */}
              <div className="col-span-3 space-y-1.5">
                <Label>Name (English) *</Label>
                <Input value={form.name} onChange={(e) => field('name')(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Name (Sinhala)</Label>
                <Input value={form.nameSinhala} onChange={(e) => field('nameSinhala')(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Name (Tamil)</Label>
                <Input value={form.nameTamil} onChange={(e) => field('nameTamil')(e.target.value)} />
              </div>
              {/* SKU / Barcode */}
              <div className="space-y-1.5">
                <Label>SKU *</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => field('sku')(e.target.value.toUpperCase())}
                  className="font-mono uppercase"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Barcode</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.barcode}
                    onChange={(e) => field('barcode')(e.target.value)}
                    className="font-mono flex-1"
                    placeholder="Scan or enter barcode"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={generateBarcode}
                    title="Generate EAN-13"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                {form.barcode.trim() && (
                  <BarcodePreview
                    barcode={form.barcode.trim()}
                    name={form.name}
                    price={form.sellingPrice}
                    currency={currency}
                  />
                )}
              </div>
              {/* Category / Unit */}
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={form.categoryId} onValueChange={field('categoryId')}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Unit *</Label>
                <Select value={form.unitId} onValueChange={field('unitId')}>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.abbreviation})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Prices */}
              <div className="space-y-1.5">
                <Label>Cost Price ({currency})</Label>
                <Input type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => field('costPrice')(e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Selling Price ({currency}) *</Label>
                <Input type="number" min="0" step="0.01" value={form.sellingPrice} onChange={(e) => field('sellingPrice')(e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Wholesale Price ({currency})</Label>
                <Input type="number" min="0" step="0.01" value={form.wholesalePrice} onChange={(e) => field('wholesalePrice')(e.target.value)} className="font-mono" placeholder="optional" />
              </div>
              <div className="space-y-1.5">
                <Label>Tax Type</Label>
                <Select value={form.taxType} onValueChange={(v) => field('taxType')(v as 'vat' | 'exempt')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vat">VAT</SelectItem>
                    <SelectItem value="exempt">Exempt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Reorder */}
              <div className="space-y-1.5">
                <Label>Reorder Level</Label>
                <Input type="number" min="0" step="0.01" value={form.reorderLevel} onChange={(e) => field('reorderLevel')(e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label>Reorder Qty</Label>
                <Input type="number" min="0" step="0.01" value={form.reorderQty} onChange={(e) => field('reorderQty')(e.target.value)} className="font-mono" />
              </div>
              {/* Toggles */}
              <div className="flex items-center justify-between">
                <Label>Has Expiry Date</Label>
                <Switch
                  checked={form.hasExpiry}
                  onCheckedChange={(v) => { field('hasExpiry')(v); if (!v) field('expiryDate')('') }}
                />
              </div>
              {form.hasExpiry && (
                <div className="space-y-1.5">
                  <Label>Expiry Date</Label>
                  <DatePickerButton
                    date={form.expiryDate ? (() => { const [y,m,d] = form.expiryDate.split('-').map(Number); return new Date(y, m-1, d) })() : undefined}
                    onSelect={(d) => field('expiryDate')(d ? format(d, 'yyyy-MM-dd') : '')}
                    placeholder="Pick expiry date"
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={form.isActive} onCheckedChange={field('isActive')} />
              </div>
              {/* Description */}
              <div className="col-span-3 space-y-1.5">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => field('description')(e.target.value)} placeholder="optional" />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving...' : dialog === 'create' ? 'Create Product' : 'Update Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{deleteTarget?.name}" ({deleteTarget?.sku})? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteProduct}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV Import Result Dialog */}
      <Dialog open={importDialog} onOpenChange={(o) => { if (!importing) setImportDialog(o) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>CSV Import {importing ? '— Processing...' : '— Complete'}</DialogTitle>
          </DialogHeader>
          {importing ? (
            <div className="py-8 text-center text-sm text-muted-foreground animate-pulse">
              Importing products...
            </div>
          ) : importResult ? (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{importResult.imported}</p>
                  <p className="text-xs text-green-600 mt-0.5">Imported</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{importResult.skipped}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Skipped</p>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-destructive mb-1">Errors ({importResult.errors.length}):</p>
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{err}</p>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          {!importing && (
            <DialogFooter>
              <Button onClick={() => setImportDialog(false)}>Close</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Batch Print Labels Dialog */}
      <Dialog open={!!batchTarget} onOpenChange={(o) => !o && setBatchTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Print Barcode Labels</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-sm font-semibold">{batchTarget?.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{batchTarget?.barcode}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Number of Labels</Label>
              <Input
                type="number"
                min="1"
                max="200"
                value={batchQty}
                onChange={(e) => setBatchQty(e.target.value)}
                className="font-mono text-lg"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchTarget(null)}>Cancel</Button>
            <Button onClick={printBatchLabels}>
              <Printer className="h-4 w-4 mr-1.5" />
              Print {parseInt(batchQty) || 1} Label{parseInt(batchQty) !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
