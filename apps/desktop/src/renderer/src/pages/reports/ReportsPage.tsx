import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { TrendingUp, ShoppingCart, DollarSign, BarChart3, CreditCard, CalendarIcon, Download } from 'lucide-react'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

// ─── Date range helpers ────────────────────────────────────────────────────────

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function endOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime()
}

const QUICK_RANGES = [
  { label: 'Today',      getRange: () => { const s = startOfDay(new Date()); return { from: s, to: s + 86400000 - 1 } } },
  { label: 'Yesterday',  getRange: () => { const s = startOfDay(new Date()) - 86400000; return { from: s, to: s + 86400000 - 1 } } },
  { label: '7 Days',     getRange: () => { const e = startOfDay(new Date()) + 86400000 - 1; return { from: e - 7 * 86400000 + 1, to: e } } },
  { label: '30 Days',    getRange: () => { const e = startOfDay(new Date()) + 86400000 - 1; return { from: e - 30 * 86400000 + 1, to: e } } },
  { label: 'This Month', getRange: () => {
    const n = new Date(); const s = new Date(n.getFullYear(), n.getMonth(), 1).getTime()
    return { from: s, to: startOfDay(new Date()) + 86400000 - 1 }
  }},
]

// ─── DatePicker button ─────────────────────────────────────────────────────────

function DatePickerButton({
  date, onSelect, placeholder, align = 'start', disabled,
}: {
  date?: Date
  onSelect: (d?: Date) => void
  placeholder: string
  align?: 'start' | 'center' | 'end'
  disabled?: (d: Date) => boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-8 w-36 justify-start gap-1.5 text-left font-normal', !date && 'text-muted-foreground')}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          {date ? format(date, 'dd MMM yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="p-0">
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

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Summary {
  totalRevenue: number
  totalTransactions: number
  totalDiscount: number
  totalTax: number
  totalCost: number
  grossProfit: number
  avgTransactionValue: number
}

interface DayRow   { day: string; total: number; count: number }
interface ProductRow { productId: string; productName: string; qtySold: number; revenue: number; profit: number }
interface PaymentRow { method: string; total: number; count: number }
interface CategoryRow { categoryId: string; categoryName: string; qtySold: number; revenue: number; cost: number; profit: number }

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color = 'text-primary',
}: {
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

function BarChart({ data, currency }: { data: DayRow[]; currency: string }) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No sales data for this period
      </div>
    )
  }
  const max = Math.max(...data.map((d) => d.total), 1)
  return (
    <div className="flex items-end gap-1 h-40 pt-2">
      {data.map((d) => {
        const pct = (d.total / max) * 100
        return (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1 min-w-0" title={`${d.day}\n${formatCurrency(d.total, currency)} (${d.count} sales)`}>
            <div
              className="w-full rounded-t bg-primary/70 hover:bg-primary transition-colors"
              style={{ height: `${Math.max(pct, 2)}%` }}
            />
            <span className="text-[9px] text-muted-foreground truncate w-full text-center">
              {d.day.slice(5)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', card: 'Card', mobile_pay: 'Mobile Pay',
  loyalty_points: 'Loyalty', credit: 'Credit', qr: 'QR',
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { session, supermarket } = useAuthStore()
  const branchId = session?.branchId ?? ''
  const currency = supermarket?.currency ?? 'LKR'

  // Date range state
  const [activeQuick, setActiveQuick] = useState('30 Days')
  const [from, setFrom] = useState(() => QUICK_RANGES.find((r) => r.label === '30 Days')!.getRange().from)
  const [to,   setTo]   = useState(() => QUICK_RANGES.find((r) => r.label === '30 Days')!.getRange().to)
  const [fromDate, setFromDate] = useState<Date | undefined>(() => new Date(QUICK_RANGES.find((r) => r.label === '30 Days')!.getRange().from))
  const [toDate,   setToDate]   = useState<Date | undefined>(() => new Date(QUICK_RANGES.find((r) => r.label === '30 Days')!.getRange().to))

  // Data state
  const [summary,   setSummary]   = useState<Summary | null>(null)
  const [daily,     setDaily]     = useState<DayRow[]>([])
  const [products,  setProducts]  = useState<ProductRow[]>([])
  const [payments,  setPayments]  = useState<PaymentRow[]>([])
  const [catProfit, setCatProfit] = useState<CategoryRow[]>([])
  const [loading,   setLoading]   = useState(false)

  const load = useCallback(async (f: number, t: number) => {
    if (!branchId) return
    setLoading(true)
    try {
      const [sRes, dRes, pRes, pmRes, cpRes] = await Promise.all([
        api.reports.getSalesSummary(branchId, f, t),
        api.reports.getDailyBreakdown(branchId, f, t),
        api.reports.getTopProducts(branchId, f, t, 10),
        api.reports.getPaymentBreakdown(branchId, f, t),
        api.reports.getProfitByCategory(branchId, f, t),
      ])
      if (sRes.success)  setSummary(sRes.data as Summary)
      if (dRes.success)  setDaily(dRes.data as DayRow[])
      if (pRes.success)  setProducts(pRes.data as ProductRow[])
      if (pmRes.success) setPayments(pmRes.data as PaymentRow[])
      if (cpRes.success) setCatProfit(cpRes.data as CategoryRow[])
    } catch { toast.error('Failed to load reports') }
    finally { setLoading(false) }
  }, [branchId])

  useEffect(() => { load(from, to) }, [load, from, to])

  function applyQuick(label: string) {
    const range = QUICK_RANGES.find((r) => r.label === label)!.getRange()
    setActiveQuick(label)
    setFrom(range.from)
    setTo(range.to)
    setFromDate(new Date(range.from))
    setToDate(new Date(range.to))
  }

  function onFromSelect(d?: Date) {
    setFromDate(d)
    setActiveQuick('')
    if (d) setFrom(startOfDay(d))
  }

  function onToSelect(d?: Date) {
    setToDate(d)
    setActiveQuick('')
    if (d) setTo(endOfDay(d))
  }

  const profitMargin = summary && summary.totalRevenue > 0
    ? ((summary.grossProfit / summary.totalRevenue) * 100).toFixed(1)
    : '0.0'

  const topRevenue = products[0]?.revenue ?? 1

  function exportCSV() {
    const dateLabel = `${new Date(from).toISOString().slice(0, 10)}_to_${new Date(to).toISOString().slice(0, 10)}`

    // Daily breakdown sheet
    const dailyHeaders = ['Date', 'Revenue', 'Transactions']
    const dailyRows = daily.map((d) => [d.day, d.total.toFixed(2), d.count])

    // Top products sheet
    const prodHeaders = ['Product', 'Qty Sold', 'Revenue', 'Profit', 'Margin %']
    const prodRows = products.map((p) => {
      const margin = p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : '0.0'
      return [p.productName, Number(p.qtySold).toFixed(1), p.revenue.toFixed(2), p.profit.toFixed(2), margin]
    })

    const toCsv = (headers: (string | number)[], rows: (string | number)[][]) =>
      [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')

    const csv = [
      `# Sales Report — ${dateLabel}`,
      `# Total Revenue,${(summary?.totalRevenue ?? 0).toFixed(2)}`,
      `# Gross Profit,${(summary?.grossProfit ?? 0).toFixed(2)}`,
      `# Total Transactions,${summary?.totalTransactions ?? 0}`,
      '',
      '## Daily Breakdown',
      toCsv(dailyHeaders, dailyRows),
      '',
      '## Top Products',
      toCsv(prodHeaders, prodRows),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales_report_${dateLabel}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={daily.length === 0 && products.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Date range controls */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
        {QUICK_RANGES.map((r) => (
          <Button
            key={r.label}
            size="sm"
            variant={activeQuick === r.label ? 'default' : 'outline'}
            onClick={() => applyQuick(r.label)}
          >
            {r.label}
          </Button>
        ))}
        <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-border">
          <DatePickerButton
            date={fromDate}
            onSelect={onFromSelect}
            placeholder="From date"
            align="start"
            disabled={(d) => toDate ? d > toDate : false}
          />
          <span className="text-muted-foreground text-sm">—</span>
          <DatePickerButton
            date={toDate}
            onSelect={onToSelect}
            placeholder="To date"
            align="end"
            disabled={(d) => (d > new Date()) || (fromDate ? d < fromDate : false)}
          />
        </div>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground animate-pulse">Loading...</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={formatCurrency(summary?.totalRevenue ?? 0, currency)}
          sub={`${summary?.totalTransactions ?? 0} transactions`}
        />
        <StatCard
          icon={TrendingUp}
          label="Gross Profit"
          value={formatCurrency(summary?.grossProfit ?? 0, currency)}
          sub={`${profitMargin}% margin`}
          color="text-green-600"
        />
        <StatCard
          icon={ShoppingCart}
          label="Avg Sale Value"
          value={formatCurrency(summary?.avgTransactionValue ?? 0, currency)}
          sub="per transaction"
        />
        <StatCard
          icon={BarChart3}
          label="Discounts Given"
          value={formatCurrency(summary?.totalDiscount ?? 0, currency)}
          sub={`Tax collected: ${formatCurrency(summary?.totalTax ?? 0, currency)}`}
          color="text-amber-600"
        />
      </div>

      {/* Daily trend + Payment breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-sm font-medium">Daily Sales Trend</p>
          <BarChart data={daily} currency={currency} />
        </div>

        {/* Payment breakdown */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-medium">Payment Methods</p>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => {
                const pct = summary?.totalRevenue
                  ? Math.round((p.total / summary.totalRevenue) * 100)
                  : 0
                return (
                  <div key={p.method} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{METHOD_LABELS[p.method] ?? p.method}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono">{formatCurrency(p.total, currency)}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top Products */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-medium">Top Products by Revenue</p>
        </div>
        {products.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No product sales in this period
          </div>
        ) : (
          <div className="divide-y divide-border">
            {products.map((p, idx) => {
              const barPct = (p.revenue / topRevenue) * 100
              const margin = p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(0) : '0'
              return (
                <div key={p.productId} className="px-4 py-3 grid grid-cols-[24px_2fr_1fr_1fr_1fr] gap-x-4 items-center">
                  <span className="text-sm font-bold text-muted-foreground">#{idx + 1}</span>
                  <div className="space-y-1">
                    <p className="text-sm font-medium line-clamp-1">{p.productName}</p>
                    <div className="h-1.5 w-full max-w-[180px] rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary/60" style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                  <p className="text-sm font-mono text-right">{Number(p.qtySold).toFixed(1)} sold</p>
                  <p className="text-sm font-mono font-medium text-right">
                    {formatCurrency(p.revenue, currency)}
                  </p>
                  <div className="text-right">
                    <Badge
                      variant={Number(margin) >= 20 ? 'success' : Number(margin) >= 0 ? 'outline' : 'destructive'}
                      className="text-xs"
                    >
                      {margin}% margin
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Profit by Category */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-medium">Profit by Category</p>
        </div>
        {catProfit.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No data for this period
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-x-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span>Category</span>
              <span className="text-right">Qty Sold</span>
              <span className="text-right">Revenue</span>
              <span className="text-right">Cost</span>
              <span className="text-right">Profit</span>
            </div>
            <div className="divide-y divide-border">
              {catProfit.map((c) => {
                const margin = c.revenue > 0 ? ((c.profit / c.revenue) * 100).toFixed(1) : '0.0'
                return (
                  <div key={c.categoryId} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-x-4 px-4 py-3 items-center">
                    <p className="text-sm font-medium">{c.categoryName}</p>
                    <p className="text-sm font-mono text-right">{Number(c.qtySold).toFixed(1)}</p>
                    <p className="text-sm font-mono text-right">{formatCurrency(c.revenue, currency)}</p>
                    <p className="text-sm font-mono text-right text-muted-foreground">{formatCurrency(c.cost, currency)}</p>
                    <div className="text-right space-y-0.5">
                      <p className="text-sm font-mono font-semibold">{formatCurrency(c.profit, currency)}</p>
                      <Badge
                        variant={Number(margin) >= 20 ? 'success' : Number(margin) >= 0 ? 'outline' : 'destructive'}
                        className="text-[10px]"
                      >
                        {margin}%
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
