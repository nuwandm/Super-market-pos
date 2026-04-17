import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search, History, User, Wallet, ArrowDownLeft, MoreVertical, MinusCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { formatCurrency } from '@/lib/utils'
import type { Customer, CreditTransaction } from '@pos/shared-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

interface FormState {
  name: string
  phone: string
  email: string
  address: string
  creditLimit: string
}

const defaultForm: FormState = { name: '', phone: '', email: '', address: '', creditLimit: '0' }

interface CustomerWithHistory extends Customer {
  recentSales?: Array<{
    id: string
    receiptNumber: string
    total: number
    status: string
    createdAt: number
  }>
}

export default function CustomersPage() {
  const { session, supermarket } = useAuthStore()
  const branchId = session?.branchId ?? ''
  const staffId  = session?.staffId  ?? ''
  const currency = supermarket?.currency ?? 'LKR'

  const [customers,     setCustomers]     = useState<Customer[]>([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [dialog,        setDialog]        = useState<'create' | 'edit' | null>(null)
  const [historyTarget, setHistoryTarget] = useState<CustomerWithHistory | null>(null)
  const [historyTab,    setHistoryTab]    = useState<'sales' | 'credit'>('sales')
  const [creditHistory, setCreditHistory] = useState<CreditTransaction[]>([])
  const [creditLoading, setCreditLoading] = useState(false)
  const [deleteTarget,  setDeleteTarget]  = useState<Customer | null>(null)
  const [editing,       setEditing]       = useState<Customer | null>(null)
  const [form,          setForm]          = useState<FormState>(defaultForm)
  const [saving,        setSaving]        = useState(false)

  // Credit dialogs
  const [topUpTarget,   setTopUpTarget]   = useState<Customer | null>(null)
  const [settleTarget,  setSettleTarget]  = useState<Customer | null>(null)
  const [adjustTarget,  setAdjustTarget]  = useState<Customer | null>(null)
  const [topUpAmount,   setTopUpAmount]   = useState('')
  const [topUpNote,     setTopUpNote]     = useState('')
  const [settleAmount,  setSettleAmount]  = useState('')
  const [settleNote,    setSettleNote]    = useState('')
  const [adjustAmount,  setAdjustAmount]  = useState('')
  const [adjustNote,    setAdjustNote]    = useState('')
  const [creditWorking, setCreditWorking] = useState(false)

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const res = await api.customers.getAll(branchId)
      if (res.success) setCustomers(res.data ?? [])
    } catch { toast.error('Failed to load customers') }
    finally { setLoading(false) }
  }, [branchId])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm(defaultForm)
    setDialog('create')
  }

  function openEdit(c: Customer) {
    setEditing(c)
    setForm({
      name:        c.name,
      phone:       c.phone,
      email:       c.email    ?? '',
      address:     c.address  ?? '',
      creditLimit: String(c.creditLimit ?? 0),
    })
    setDialog('edit')
  }

  async function openHistory(c: Customer) {
    const res = await api.customers.getById(c.id)
    if (res.success && res.data) setHistoryTarget(res.data as CustomerWithHistory)
    else setHistoryTarget({ ...c, recentSales: [] })
    setHistoryTab('sales')
    setCreditHistory([])
  }

  async function loadCreditHistory(customerId: string) {
    setCreditLoading(true)
    try {
      const res = await api.customers.getCreditHistory(customerId)
      if (res.success) setCreditHistory((res.data ?? []) as CreditTransaction[])
    } catch { toast.error('Failed to load credit history') }
    finally { setCreditLoading(false) }
  }

  async function save() {
    if (!form.name.trim())  { toast.error('Name is required');         return }
    if (!form.phone.trim()) { toast.error('Phone number is required'); return }
    setSaving(true)
    try {
      const data = {
        branchId,
        name:        form.name.trim(),
        phone:       form.phone.trim(),
        email:       form.email.trim()   || undefined,
        address:     form.address.trim() || undefined,
        creditLimit: parseFloat(form.creditLimit) || 0,
      }
      const res = dialog === 'create'
        ? await api.customers.create(data)
        : await api.customers.update(editing!.id, data)
      if (!res.success) { toast.error(res.error ?? 'Failed to save'); return }
      toast.success(dialog === 'create' ? 'Customer added' : 'Customer updated')
      setDialog(null)
      await load()
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  async function deleteCustomer() {
    if (!deleteTarget) return
    try {
      const res = await api.customers.delete(deleteTarget.id)
      if (!res.success) { toast.error(res.error ?? 'Failed to delete'); return }
      toast.success('Customer deleted')
      setDeleteTarget(null)
      await load()
    } catch { toast.error('Delete failed') }
  }

  async function submitTopUp() {
    if (!topUpTarget) return
    const amount = parseFloat(topUpAmount)
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return }
    setCreditWorking(true)
    try {
      const res = await api.customers.topUp({
        customerId: topUpTarget.id,
        branchId,
        staffId,
        amount,
        note: topUpNote.trim() || undefined,
      })
      if (!res.success) { toast.error(res.error ?? 'Top-up failed'); return }
      toast.success(`Top-up of ${formatCurrency(amount, currency)} successful`)
      setTopUpTarget(null)
      await load()
    } catch { toast.error('Top-up failed') }
    finally { setCreditWorking(false) }
  }

  async function submitSettle() {
    if (!settleTarget) return
    const amount = parseFloat(settleAmount)
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return }
    setCreditWorking(true)
    try {
      const res = await api.customers.settle({
        customerId: settleTarget.id,
        branchId,
        staffId,
        amount,
        note: settleNote.trim() || undefined,
      })
      if (!res.success) { toast.error(res.error ?? 'Settlement failed'); return }
      toast.success(`Settlement of ${formatCurrency(amount, currency)} recorded`)
      setSettleTarget(null)
      await load()
    } catch { toast.error('Settlement failed') }
    finally { setCreditWorking(false) }
  }

  async function submitAdjust() {
    if (!adjustTarget) return
    const amount = parseFloat(adjustAmount)
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return }
    if (amount > (adjustTarget.creditBalance)) {
      toast.error(`Cannot deduct more than current balance (${formatCurrency(adjustTarget.creditBalance, currency)})`)
      return
    }
    setCreditWorking(true)
    try {
      const res = await api.customers.adjustCredit({
        customerId: adjustTarget.id,
        branchId,
        staffId,
        amount:     -amount,  // negative = deduct
        note:       adjustNote.trim() || undefined,
      })
      if (!res.success) { toast.error(res.error ?? 'Adjustment failed'); return }
      toast.success(`Deducted ${formatCurrency(amount, currency)} from wallet`)
      setAdjustTarget(null)
      await load()
    } catch { toast.error('Adjustment failed') }
    finally { setCreditWorking(false) }
  }

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.email ?? '').toLowerCase().includes(q)
  })

  function creditColor(bal: number) {
    if (bal > 0) return 'text-green-600'
    if (bal < 0) return 'text-red-500'
    return 'text-muted-foreground'
  }

  function creditTxLabel(type: string) {
    switch (type) {
      case 'top_up':     return 'Top Up'
      case 'sale':       return 'Sale'
      case 'settlement': return 'Settlement'
      case 'adjustment': return 'Adjustment'
      default:           return type
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Customers</h1>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="pl-8"
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add Customer
        </Button>
      </div>

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        {customers.length} customer{customers.length !== 1 ? 's' : ''} total
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_40px] gap-x-4 px-4 py-2 border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>Customer</span>
          <span>Phone</span>
          <span className="text-right">Loyalty Pts</span>
          <span className="text-right">Total Purchases</span>
          <span className="text-right">Credit Balance</span>
          <span>Status</span>
          <span />
        </div>

        {loading ? (
          <div className="space-y-0 divide-y divide-border">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-card animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {search ? 'No customers match your search' : 'No customers yet. Add one to get started.'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_40px] gap-x-4 items-center px-4 py-3"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                  </div>
                </div>
                <p className="text-sm font-mono">{c.phone}</p>
                <p className="text-sm font-mono text-right">{Math.floor(c.loyaltyPoints)}</p>
                <p className="text-sm font-mono text-right">{formatCurrency(c.totalPurchases, currency)}</p>
                <p className={`text-sm font-mono text-right font-semibold ${creditColor(c.creditBalance)}`}>
                  {c.creditBalance < 0
                    ? `(${formatCurrency(Math.abs(c.creditBalance), currency)})`
                    : formatCurrency(c.creditBalance, currency)}
                </p>
                <Badge variant={c.isActive ? 'success' : 'outline'}>
                  {c.isActive ? 'Active' : 'Inactive'}
                </Badge>

                {/* Kebab menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openHistory(c)}>
                      <History className="h-4 w-4 mr-2" /> View History
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setTopUpTarget(c); setTopUpAmount(''); setTopUpNote('') }}>
                      <Wallet className="h-4 w-4 mr-2 text-green-600" /> Top Up Credit
                    </DropdownMenuItem>
                    {c.creditBalance > 0 && (
                      <DropdownMenuItem onClick={() => { setAdjustTarget(c); setAdjustAmount(''); setAdjustNote('') }}>
                        <MinusCircle className="h-4 w-4 mr-2 text-orange-500" /> Refund / Deduct Wallet
                      </DropdownMenuItem>
                    )}
                    {c.creditBalance < 0 && (
                      <DropdownMenuItem onClick={() => { setSettleTarget(c); setSettleAmount(''); setSettleNote('') }}>
                        <ArrowDownLeft className="h-4 w-4 mr-2 text-amber-600" /> Settle Debt
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleteTarget(c)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === 'create' ? 'New Customer' : 'Edit Customer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Nimal Perera"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone Number <span className="text-destructive">*</span></Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="e.g. 0711234567"
                type="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="optional"
                type="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Credit Limit ({currency})</Label>
              <Input
                value={form.creditLimit}
                onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))}
                placeholder="0.00"
                type="number"
                min="0"
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">
                0 = wallet top-up only. Positive value = max deferred debt allowed.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving...' : dialog === 'create' ? 'Add Customer' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={!!historyTarget} onOpenChange={(o) => !o && setHistoryTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Customer — {historyTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3">
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-mono">{historyTarget?.phone}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Loyalty Points</p>
                <p className="font-semibold">{Math.floor(historyTarget?.loyaltyPoints ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Purchases</p>
                <p className="font-semibold">{formatCurrency(historyTarget?.totalPurchases ?? 0, currency)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Credit Balance</p>
                <p className={`font-semibold ${creditColor(historyTarget?.creditBalance ?? 0)}`}>
                  {(historyTarget?.creditBalance ?? 0) < 0
                    ? `(${formatCurrency(Math.abs(historyTarget?.creditBalance ?? 0), currency)}) owes`
                    : formatCurrency(historyTarget?.creditBalance ?? 0, currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Credit Limit</p>
                <p className="font-semibold">{formatCurrency(historyTarget?.creditLimit ?? 0, currency)}</p>
              </div>
            </div>

            {/* Tabs */}
            <Tabs
              value={historyTab}
              onValueChange={(v) => {
                setHistoryTab(v as 'sales' | 'credit')
                if (v === 'credit' && historyTarget) loadCreditHistory(historyTarget.id)
              }}
            >
              <TabsList className="w-full">
                <TabsTrigger value="sales" className="flex-1">Purchase History</TabsTrigger>
                <TabsTrigger value="credit" className="flex-1">Credit History</TabsTrigger>
              </TabsList>

              <TabsContent value="sales">
                <ScrollArea className="h-52">
                  {(historyTarget?.recentSales ?? []).length === 0 ? (
                    <p className="text-center text-muted-foreground py-6">No purchases yet</p>
                  ) : (
                    <div className="space-y-1 pt-2">
                      {(historyTarget?.recentSales ?? []).map((s) => (
                        <div key={s.id} className="flex items-center justify-between rounded-md px-3 py-2 bg-muted/40">
                          <div>
                            <p className="font-mono text-xs">{s.receiptNumber}</p>
                            <p className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(s.total, currency)}</p>
                            <Badge
                              variant={s.status === 'completed' ? 'success' : 'destructive'}
                              className="text-[10px] h-4 px-1"
                            >
                              {s.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="credit">
                <ScrollArea className="h-52">
                  {creditLoading ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">Loading...</div>
                  ) : creditHistory.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6">No credit transactions yet</p>
                  ) : (
                    <div className="space-y-1 pt-2">
                      {creditHistory.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between rounded-md px-3 py-2 bg-muted/40">
                          <div>
                            <p className="text-xs font-medium">{creditTxLabel(tx.type)}</p>
                            <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                            {tx.note && <p className="text-xs text-muted-foreground italic">{tx.note}</p>}
                          </div>
                          <div className="text-right">
                            <p className={`font-mono font-semibold text-sm ${tx.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount, currency)}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              Bal: {formatCurrency(tx.balanceAfter, currency)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Top Up Dialog */}
      <Dialog open={!!topUpTarget} onOpenChange={(o) => !o && setTopUpTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Top Up Credit — {topUpTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Current balance:{' '}
              <span className={`font-semibold font-mono ${creditColor(topUpTarget?.creditBalance ?? 0)}`}>
                {formatCurrency(topUpTarget?.creditBalance ?? 0, currency)}
              </span>
            </p>
            <div className="space-y-1.5">
              <Label>Amount ({currency}) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                className="font-mono text-lg"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input
                value={topUpNote}
                onChange={(e) => setTopUpNote(e.target.value)}
                placeholder="e.g. Cash received"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopUpTarget(null)}>Cancel</Button>
            <Button onClick={submitTopUp} disabled={creditWorking}>
              <Wallet className="h-4 w-4 mr-1.5" />
              {creditWorking ? 'Processing...' : 'Top Up'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle Debt Dialog */}
      <Dialog open={!!settleTarget} onOpenChange={(o) => !o && setSettleTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Settle Debt — {settleTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Outstanding debt:{' '}
              <span className="font-semibold font-mono text-red-500">
                {formatCurrency(Math.abs(settleTarget?.creditBalance ?? 0), currency)}
              </span>
            </p>
            <div className="space-y-1.5">
              <Label>Payment Amount ({currency}) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                className="font-mono text-lg"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
                placeholder="e.g. Cash payment"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleTarget(null)}>Cancel</Button>
            <Button onClick={submitSettle} disabled={creditWorking} className="bg-amber-600 hover:bg-amber-700">
              <ArrowDownLeft className="h-4 w-4 mr-1.5" />
              {creditWorking ? 'Processing...' : 'Record Settlement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund / Deduct Wallet Dialog */}
      <Dialog open={!!adjustTarget} onOpenChange={(o) => !o && setAdjustTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Refund / Deduct Wallet — {adjustTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Current wallet balance:{' '}
              <span className="font-semibold font-mono text-green-600">
                {formatCurrency(adjustTarget?.creditBalance ?? 0, currency)}
              </span>
            </p>
            <div className="space-y-1.5">
              <Label>Amount to Deduct ({currency}) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                max={adjustTarget?.creditBalance ?? 0}
                placeholder="0.00"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="font-mono text-lg"
                autoFocus
              />
              {adjustAmount && parseFloat(adjustAmount) > 0 && (
                <p className="text-xs text-muted-foreground">
                  New balance:{' '}
                  <span className={`font-semibold font-mono ${(adjustTarget?.creditBalance ?? 0) - parseFloat(adjustAmount) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {formatCurrency((adjustTarget?.creditBalance ?? 0) - parseFloat(adjustAmount), currency)}
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Input
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="e.g. Customer refund request"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustTarget(null)}>Cancel</Button>
            <Button onClick={submitAdjust} disabled={creditWorking} className="bg-orange-600 hover:bg-orange-700">
              <MinusCircle className="h-4 w-4 mr-1.5" />
              {creditWorking ? 'Processing...' : 'Deduct'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{deleteTarget?.name}" ({deleteTarget?.phone})? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteCustomer}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
