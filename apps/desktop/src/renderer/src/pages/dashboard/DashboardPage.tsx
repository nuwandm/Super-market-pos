import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  ShoppingCart, TrendingUp, AlertTriangle, DollarSign,
  Clock, Play, Square, CalendarClock, Wallet, Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { formatCurrency, formatTime } from '@/lib/utils'
import type { DailySalesReport, CashSession, ExpiringProduct } from '@pos/shared-types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LowStockRow {
  productId: string
  qtyOnHand: number
  productName: string
  reorderLevel: number
  reorderQty: number
  unitAbbr?: string | null
}

interface CreditSummary {
  totalWallet: number
  totalDebt: number
  debtorCount: number
  walletCount: number
  debtors: Array<{ id: string; name: string; phone: string; creditBalance: number }>
}

export default function DashboardPage() {
  const { session, supermarket } = useAuthStore()
  const navigate  = useNavigate()
  const branchId = session?.branchId ?? ''
  const currency  = supermarket?.currency ?? 'LKR'

  const [summary,       setSummary]       = useState<DailySalesReport | null>(null)
  const [lowStock,      setLowStock]      = useState<LowStockRow[]>([])
  const [expiring,      setExpiring]      = useState<ExpiringProduct[]>([])
  const [cashSession,   setCashSession]   = useState<CashSession | null>(null)
  const [creditSummary, setCreditSummary] = useState<CreditSummary | null>(null)
  const [loading,       setLoading]       = useState(true)

  const [sessionDialog,  setSessionDialog]  = useState<'open' | 'close' | null>(null)
  const [floatAmount,    setFloatAmount]    = useState('')
  const [closingCash,    setClosingCash]    = useState('')
  const [sessionLoading, setSessionLoading] = useState(false)

  const load = useCallback(async () => {
    if (!branchId || !session) return
    setLoading(true)
    try {
      const [summaryRes, lowStockRes, sessionRes, expiringRes, creditRes] = await Promise.all([
        api.sales.getDailySummary(branchId),
        api.inventory.getLowStock(branchId),
        api.sales.getCurrentSession(session.staffId, branchId),
        api.products.getExpiring(branchId, 60),
        api.customers.getCreditSummary(branchId),
      ])
      if (summaryRes.success)  setSummary(summaryRes.data ?? null)
      if (lowStockRes.success) setLowStock((lowStockRes.data ?? []) as LowStockRow[])
      if (sessionRes.success)  setCashSession(sessionRes.data ?? null)
      if (expiringRes.success) setExpiring((expiringRes.data ?? []) as ExpiringProduct[])
      if (creditRes.success)   setCreditSummary(creditRes.data as CreditSummary ?? null)
    } catch { toast.error('Failed to load dashboard') }
    finally { setLoading(false) }
  }, [branchId, session])

  useEffect(() => { load() }, [load])

  async function openSession() {
    const amount = parseFloat(floatAmount)
    if (isNaN(amount) || amount < 0) { toast.error('Enter a valid opening float'); return }
    setSessionLoading(true)
    try {
      const res = await api.sales.openSession(session!.staffId, branchId, amount)
      if (!res.success) { toast.error(res.error ?? 'Failed to open session'); return }
      toast.success('Cash session opened')
      setSessionDialog(null); setFloatAmount('')
      await load()
    } catch { toast.error('Error opening session') }
    finally { setSessionLoading(false) }
  }

  async function closeSession() {
    if (!cashSession) return
    const amount = parseFloat(closingCash)
    if (isNaN(amount) || amount < 0) { toast.error('Enter closing cash amount'); return }
    setSessionLoading(true)
    try {
      const res = await api.sales.closeSession(cashSession.id, amount)
      if (!res.success) { toast.error(res.error ?? 'Failed to close session'); return }
      toast.success('Session closed')
      setSessionDialog(null); setClosingCash('')
      await load()
    } catch { toast.error('Error closing session') }
    finally { setSessionLoading(false) }
  }

  function daysUntilExpiry(ts: number) {
    return Math.ceil((ts - Date.now()) / 86400000)
  }

  const stats = [
    { label: 'Total Sales',    value: formatCurrency(summary?.totalSales ?? 0, currency),   icon: DollarSign,    sub: `${summary?.totalTransactions ?? 0} transactions today`, route: '/sales' },
    { label: 'Cash',           value: formatCurrency(summary?.totalCash ?? 0, currency),    icon: TrendingUp,    sub: 'cash payments',   route: '/sales' },
    { label: 'Card / Mobile',  value: formatCurrency((summary?.totalCard ?? 0) + (summary?.totalMobilePay ?? 0), currency), icon: ShoppingCart, sub: 'non-cash payments', route: '/sales' },
    { label: 'Total Discount', value: formatCurrency(summary?.totalDiscount ?? 0, currency), icon: AlertTriangle, sub: 'given today',     route: '/sales' },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-LK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {cashSession ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-green-600">
                <Clock className="h-4 w-4" />
                <span>Session open since {formatTime(cashSession.openedAt)}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setClosingCash(''); setSessionDialog('close') }}>
                <Square className="h-3 w-3 mr-1" /> Close Session
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => { setFloatAmount(''); setSessionDialog('open') }}>
              <Play className="h-3 w-3 mr-1" /> Open Session
            </Button>
          )}
        </div>
      </div>

      {/* Sales Stats */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map((i) => <div key={i} className="h-28 rounded-xl border border-border bg-card animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {stats.map((stat) => (
            <button
              key={stat.label}
              onClick={() => navigate(stat.route)}
              className="rounded-xl border border-border bg-card p-4 space-y-3 text-left transition-all hover:border-primary hover:shadow-md cursor-pointer w-full"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xl font-bold font-mono">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.sub}</p>
            </button>
          ))}
        </div>
      )}

      {/* Credit Overview Cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1,2].map((i) => <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Total Wallet */}
          <button onClick={() => navigate('/customers')} className="rounded-xl border border-green-200 bg-green-50/50 p-4 flex items-center justify-between text-left transition-all hover:shadow-md hover:border-green-400 w-full cursor-pointer">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-green-600" />
                Total Wallet Credit
              </p>
              <p className="text-2xl font-bold font-mono text-green-700">
                {formatCurrency(creditSummary?.totalWallet ?? 0, currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                {creditSummary?.walletCount ?? 0} customer{(creditSummary?.walletCount ?? 0) !== 1 ? 's' : ''} with pre-loaded credit
              </p>
            </div>
          </button>

          {/* Outstanding Debt */}
          <button onClick={() => navigate('/customers')} className={`rounded-xl border p-4 flex items-center justify-between text-left transition-all hover:shadow-md w-full cursor-pointer ${
            (creditSummary?.totalDebt ?? 0) > 0
              ? 'border-red-200 bg-red-50/50'
              : 'border-border bg-card'
          } hover:border-red-400`}>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Users className={`h-4 w-4 ${(creditSummary?.totalDebt ?? 0) > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                Outstanding Debt
              </p>
              <p className={`text-2xl font-bold font-mono ${(creditSummary?.totalDebt ?? 0) > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                {formatCurrency(creditSummary?.totalDebt ?? 0, currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                {creditSummary?.debtorCount ?? 0} customer{(creditSummary?.debtorCount ?? 0) !== 1 ? 's' : ''} owe money
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Low stock */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Low Stock
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant="warning">{lowStock.length}</Badge>
              <button onClick={() => navigate('/inventory')} className="text-xs text-primary hover:underline">View all →</button>
            </div>
          </div>
          {lowStock.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">All stock levels are healthy</div>
          ) : (
            <div className="divide-y divide-border">
              {lowStock.slice(0, 7).map((item) => (
                <button key={item.productId} onClick={() => navigate('/inventory')} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-accent transition-colors text-left">
                  <div className="min-w-0 mr-2">
                    <p className="text-sm font-medium truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">Reorder at {item.reorderLevel}</p>
                  </div>
                  <p className={`text-sm font-mono font-semibold shrink-0 ${item.qtyOnHand <= 0 ? 'text-destructive' : 'text-orange-600'}`}>
                    {item.qtyOnHand} {item.unitAbbr ?? ''}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Expiring soon */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-semibold flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-500" />
              Expiring Soon
              <span className="text-xs font-normal text-muted-foreground">(60d)</span>
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant={expiring.length > 0 ? 'warning' : 'outline'}>{expiring.length}</Badge>
              <button onClick={() => navigate('/products')} className="text-xs text-primary hover:underline">View all →</button>
            </div>
          </div>
          {expiring.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No products expiring soon</div>
          ) : (
            <div className="divide-y divide-border">
              {expiring.slice(0, 7).map((item) => {
                const days = daysUntilExpiry(item.expiryDate)
                const urgent = days <= 14
                return (
                  <button key={item.id} onClick={() => navigate('/products')} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-accent transition-colors text-left">
                    <div className="min-w-0 mr-2">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-mono font-semibold ${urgent ? 'text-destructive' : 'text-amber-600'}`}>
                        {days <= 0 ? 'Expired!' : `${days}d`}
                      </p>
                      <p className="text-xs text-muted-foreground">qty {item.qtyOnHand ?? 0}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Credit Debtors */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-red-500" />
              Customers with Debt
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant={(creditSummary?.debtorCount ?? 0) > 0 ? 'destructive' : 'outline'}>
                {creditSummary?.debtorCount ?? 0}
              </Badge>
              <button onClick={() => navigate('/customers')} className="text-xs text-primary hover:underline">View all →</button>
            </div>
          </div>
          {(creditSummary?.debtors ?? []).length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No outstanding debts</div>
          ) : (
            <div className="divide-y divide-border">
              {(creditSummary?.debtors ?? []).map((d) => (
                <button key={d.id} onClick={() => navigate('/customers')} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-accent transition-colors text-left">
                  <div className="min-w-0 mr-2">
                    <p className="text-sm font-medium truncate">{d.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{d.phone}</p>
                  </div>
                  <p className="text-sm font-mono font-semibold text-red-500 shrink-0">
                    ({formatCurrency(Math.abs(d.creditBalance), currency)})
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Open Session Dialog */}
      <Dialog open={sessionDialog === 'open'} onOpenChange={(o) => !o && setSessionDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Open Cash Session</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Opening Float ({currency})</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00"
                value={floatAmount} onChange={(e) => setFloatAmount(e.target.value)}
                className="font-mono text-lg" autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionDialog(null)}>Cancel</Button>
            <Button onClick={openSession} disabled={sessionLoading}>{sessionLoading ? 'Opening...' : 'Open Session'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Session Dialog */}
      <Dialog open={sessionDialog === 'close'} onOpenChange={(o) => !o && setSessionDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Close Cash Session</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Opening Float</span>
              <span className="font-mono font-medium">{formatCurrency(cashSession?.openingFloat ?? 0, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Expected Cash</span>
              <span className="font-mono font-medium">{formatCurrency(cashSession?.expectedCash ?? 0, currency)}</span>
            </div>
            <Separator />
            <div className="space-y-1.5">
              <Label>Actual Closing Cash ({currency})</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00"
                value={closingCash} onChange={(e) => setClosingCash(e.target.value)}
                className="font-mono text-lg" autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionDialog(null)}>Cancel</Button>
            <Button onClick={closeSession} disabled={sessionLoading}>{sessionLoading ? 'Closing...' : 'Close Session'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
