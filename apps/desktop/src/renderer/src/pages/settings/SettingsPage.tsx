import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, KeyRound, RotateCcw, HardDrive, Upload, ImagePlus, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { useShortcutsStore } from '@/stores/shortcuts.store'
import type { Unit, Staff } from '@pos/shared-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// ─── Supermarket Tab ─────────────────────────────────────────────────────────

function SupermarketTab() {
  const { supermarket, setContext, session } = useAuthStore()
  const [form, setForm] = useState({
    name:            supermarket?.name            ?? '',
    phone:           supermarket?.phone           ?? '',
    email:           supermarket?.email           ?? '',
    address:         supermarket?.address         ?? '',
    currency:        supermarket?.currency        ?? 'LKR',
    taxRate:         String(supermarket?.taxRate  ?? 0),
    vatNumber:       supermarket?.vatNumber       ?? '',
    receiptHeader:   supermarket?.receiptHeader   ?? '',
    receiptFooter:   supermarket?.receiptFooter   ?? '',
    receiptLanguage: supermarket?.receiptLanguage ?? 'en',
  })
  const [saving,        setSaving]        = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)

  useEffect(() => {
    if (!supermarket) return
    setForm({
      name:            supermarket.name,
      phone:           supermarket.phone           ?? '',
      email:           supermarket.email           ?? '',
      address:         supermarket.address         ?? '',
      currency:        supermarket.currency,
      taxRate:         String(supermarket.taxRate),
      vatNumber:       supermarket.vatNumber       ?? '',
      receiptHeader:   supermarket.receiptHeader   ?? '',
      receiptFooter:   supermarket.receiptFooter   ?? '',
      receiptLanguage: supermarket.receiptLanguage,
    })
  }, [supermarket])

  function f(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, [key]: e.target.value }))
  }

  async function refreshContext() {
    if (session?.branchId) {
      const ctx = await api.auth.getContext(session.branchId)
      if (ctx.success && ctx.data) setContext(ctx.data.supermarket, ctx.data.branch)
    }
  }

  async function save() {
    if (!supermarket) return
    setSaving(true)
    try {
      const data = { ...form, taxRate: parseFloat(form.taxRate) || 0 }
      const res = await api.settings.updateSupermarket(supermarket.id, data)
      if (!res.success) { toast.error(res.error ?? 'Update failed'); return }
      await refreshContext()
      toast.success('Settings saved')
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  async function uploadLogo() {
    if (!supermarket) return
    setLogoUploading(true)
    try {
      const res = await api.settings.uploadLogo(supermarket.id)
      if (!res.success) {
        if (res.error !== 'Cancelled') toast.error(res.error ?? 'Upload failed')
        return
      }
      await refreshContext()
      toast.success('Logo updated')
    } catch { toast.error('Upload failed') }
    finally { setLogoUploading(false) }
  }

  async function removeLogo() {
    if (!supermarket) return
    setLogoUploading(true)
    try {
      const res = await api.settings.removeLogo(supermarket.id)
      if (!res.success) { toast.error(res.error ?? 'Remove failed'); return }
      await refreshContext()
      toast.success('Logo removed')
    } catch { toast.error('Remove failed') }
    finally { setLogoUploading(false) }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Logo */}
      <div className="flex items-center gap-5 p-4 rounded-xl border border-border bg-card">
        <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted border border-border overflow-hidden shrink-0">
          {supermarket?.logoPath ? (
            <img src={supermarket.logoPath} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <ImagePlus className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Company Logo</p>
          <p className="text-xs text-muted-foreground">PNG, JPG, SVG or WebP — max 2 MB. Shown in the sidebar and on receipts.</p>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={uploadLogo} disabled={logoUploading}>
              <ImagePlus className="h-3.5 w-3.5 mr-1.5" />
              {logoUploading ? 'Uploading…' : supermarket?.logoPath ? 'Change Logo' : 'Upload Logo'}
            </Button>
            {supermarket?.logoPath && (
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={removeLogo} disabled={logoUploading}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>Supermarket Name</Label>
          <Input value={form.name} onChange={f('name')} />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={f('phone')} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={f('email')} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Address</Label>
          <Input value={form.address} onChange={f('address')} />
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Input value={form.currency} onChange={f('currency')} placeholder="LKR" />
        </div>
        <div className="space-y-1.5">
          <Label>Default Tax Rate (%)</Label>
          <Input type="number" min="0" max="100" step="0.01" value={form.taxRate} onChange={f('taxRate')} className="font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label>VAT Number</Label>
          <Input value={form.vatNumber} onChange={f('vatNumber')} />
        </div>
        <div className="space-y-1.5">
          <Label>Receipt Language</Label>
          <Input value={form.receiptLanguage} onChange={f('receiptLanguage')} placeholder="en" />
        </div>
        <div className="space-y-1.5">
          <Label>Receipt Header</Label>
          <Input value={form.receiptHeader} onChange={f('receiptHeader')} placeholder="e.g. Thank you for shopping!" />
        </div>
        <div className="space-y-1.5">
          <Label>Receipt Footer</Label>
          <Input value={form.receiptFooter} onChange={f('receiptFooter')} placeholder="e.g. Come again!" />
        </div>
      </div>
      <Button onClick={save} disabled={saving}>
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  )
}

// ─── Branch Tab ───────────────────────────────────────────────────────────────

function BranchTab() {
  const { branch, session, setContext } = useAuthStore()
  const [form, setForm] = useState({
    name:          branch?.name          ?? '',
    phone:         branch?.phone         ?? '',
    address:       branch?.address       ?? '',
    taxRate:       branch?.taxRate != null ? String(branch.taxRate) : '',
    receiptHeader: branch?.receiptHeader ?? '',
    receiptFooter: branch?.receiptFooter ?? '',
    isActive:      branch?.isActive      ?? true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!branch) return
    setForm({
      name:          branch.name,
      phone:         branch.phone         ?? '',
      address:       branch.address       ?? '',
      taxRate:       branch.taxRate != null ? String(branch.taxRate) : '',
      receiptHeader: branch.receiptHeader ?? '',
      receiptFooter: branch.receiptFooter ?? '',
      isActive:      branch.isActive,
    })
  }, [branch])

  function f(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((s) => ({ ...s, [key]: e.target.value }))
  }

  async function save() {
    if (!branch) return
    setSaving(true)
    try {
      const data = {
        ...form,
        taxRate: form.taxRate ? parseFloat(form.taxRate) : null,
      }
      const res = await api.settings.updateBranch(branch.id, data)
      if (!res.success) { toast.error(res.error ?? 'Update failed'); return }
      if (session?.branchId) {
        const ctx = await api.auth.getContext(session.branchId)
        if (ctx.success && ctx.data) setContext(ctx.data.supermarket, ctx.data.branch)
      }
      toast.success('Branch settings saved')
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>Branch Name</Label>
          <Input value={form.name} onChange={f('name')} />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={f('phone')} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Address</Label>
          <Input value={form.address} onChange={f('address')} />
        </div>
        <div className="space-y-1.5">
          <Label>Tax Rate Override (%)</Label>
          <Input type="number" min="0" max="100" step="0.01" value={form.taxRate} onChange={f('taxRate')} className="font-mono" placeholder="Leave blank to use supermarket default" />
        </div>
        <div className="space-y-1.5">
          <Label>Receipt Header</Label>
          <Input value={form.receiptHeader} onChange={f('receiptHeader')} />
        </div>
        <div className="space-y-1.5">
          <Label>Receipt Footer</Label>
          <Input value={form.receiptFooter} onChange={f('receiptFooter')} />
        </div>
        <div className="flex items-center justify-between col-span-2">
          <Label>Branch Active</Label>
          <Switch checked={form.isActive} onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: v }))} />
        </div>
      </div>
      <Button onClick={save} disabled={saving}>
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  )
}

// ─── Units Tab ────────────────────────────────────────────────────────────────

interface UnitForm { name: string; abbreviation: string; isDecimal: boolean }
const defaultUnitForm: UnitForm = { name: '', abbreviation: '', isDecimal: false }

function UnitsTab() {
  const { session } = useAuthStore()
  const branchId = session?.branchId ?? ''

  const [units,   setUnits]   = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog,  setDialog]  = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Unit | null>(null)
  const [form,    setForm]    = useState<UnitForm>(defaultUnitForm)
  const [saving,  setSaving]  = useState(false)

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const res = await api.settings.getUnits(branchId)
      if (res.success) setUnits(res.data ?? [])
    } catch { toast.error('Failed to load units') }
    finally { setLoading(false) }
  }, [branchId])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!form.name.trim() || !form.abbreviation.trim()) {
      toast.error('Name and abbreviation are required')
      return
    }
    setSaving(true)
    try {
      const data = { branchId, ...form }
      const res = dialog === 'create'
        ? await api.settings.createUnit(data)
        : await api.settings.updateUnit(editing!.id, data)
      if (!res.success) { toast.error(res.error ?? 'Failed to save'); return }
      toast.success(dialog === 'create' ? 'Unit created' : 'Unit updated')
      setDialog(null)
      await load()
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setForm(defaultUnitForm); setDialog('create') }}>
          <Plus className="h-4 w-4 mr-2" /> Add Unit
        </Button>
      </div>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : units.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No units defined</div>
        ) : units.map((u) => (
          <div key={u.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{u.name} ({u.abbreviation})</p>
              <p className="text-xs text-muted-foreground">{u.isDecimal ? 'Decimal quantities allowed' : 'Whole quantities only'}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => {
              setEditing(u)
              setForm({ name: u.name, abbreviation: u.abbreviation, isDecimal: u.isDecimal })
              setDialog('edit')
            }}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{dialog === 'create' ? 'New Unit' : 'Edit Unit'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Kilogram" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Abbreviation *</Label>
              <Input value={form.abbreviation} onChange={(e) => setForm((f) => ({ ...f, abbreviation: e.target.value }))} placeholder="e.g. kg" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Allow Decimal Quantities</Label>
              <Switch checked={form.isDecimal} onCheckedChange={(v) => setForm((f) => ({ ...f, isDecimal: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : dialog === 'create' ? 'Create' : 'Update'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Staff Tab ────────────────────────────────────────────────────────────────

const ROLES = [
  { value: 'super_admin',  label: 'Super Admin'  },
  { value: 'manager',      label: 'Manager'      },
  { value: 'cashier',      label: 'Cashier'      },
  { value: 'stock_keeper', label: 'Stock Keeper' },
  { value: 'viewer',       label: 'Viewer'       },
]

const roleLabel: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.value, r.label]))

interface StaffForm {
  name: string; staffCode: string; pin: string; confirmPin: string
  role: string; isActive: boolean
}
const defaultStaffForm: StaffForm = { name: '', staffCode: '', pin: '', confirmPin: '', role: 'cashier', isActive: true }

function StaffTab() {
  const { session } = useAuthStore()
  const branchId = session?.branchId ?? ''

  const [staff,   setStaff]   = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog,  setDialog]  = useState<'create' | 'edit' | 'resetPin' | null>(null)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [form,    setForm]    = useState<StaffForm>(defaultStaffForm)
  const [newPin,       setNewPin]       = useState('')
  const [confirmNewPin, setConfirmNewPin] = useState('')
  const [saving,  setSaving]  = useState(false)

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const res = await api.settings.getStaff(branchId)
      if (res.success) setStaff(res.data ?? [])
    } catch { toast.error('Failed to load staff') }
    finally { setLoading(false) }
  }, [branchId])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm(defaultStaffForm)
    setDialog('create')
  }

  function openEdit(s: Staff) {
    setEditing(s)
    setForm({ name: s.name, staffCode: s.staffCode, pin: '', confirmPin: '', role: s.role, isActive: s.isActive })
    setDialog('edit')
  }

  function openResetPin(s: Staff) {
    setEditing(s)
    setNewPin('')
    setConfirmNewPin('')
    setDialog('resetPin')
  }

  async function saveStaff() {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (dialog === 'create') {
      if (!form.staffCode.trim()) { toast.error('Username is required'); return }
      if (form.pin.length < 4)   { toast.error('PIN must be 4–6 digits'); return }
      if (form.pin !== form.confirmPin) { toast.error('PINs do not match'); return }
    }
    setSaving(true)
    try {
      if (dialog === 'create') {
        const res = await api.settings.createStaff({
          branchId, name: form.name.trim(), username: form.staffCode.trim(),
          pin: form.pin, role: form.role,
        })
        if (!res.success) { toast.error(res.error ?? 'Failed to create staff'); return }
        toast.success('Staff member created')
      } else {
        const res = await api.settings.updateStaff(editing!.id, {
          name: form.name.trim(), role: form.role, isActive: form.isActive,
        })
        if (!res.success) { toast.error(res.error ?? 'Failed to update'); return }
        toast.success('Staff updated')
      }
      setDialog(null)
      await load()
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  async function resetPin() {
    if (newPin.length < 4) { toast.error('PIN must be 4–6 digits'); return }
    if (newPin !== confirmNewPin) { toast.error('PINs do not match'); return }
    setSaving(true)
    try {
      const res = await api.settings.resetStaffPin(editing!.id, newPin)
      if (!res.success) { toast.error(res.error ?? 'Failed to reset PIN'); return }
      toast.success('PIN reset successfully')
      setDialog(null)
    } catch { toast.error('Reset failed') }
    finally { setSaving(false) }
  }

  function ff(key: keyof StaffForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((s) => ({ ...s, [key]: e.target.value }))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add Staff
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : staff.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No staff found</div>
        ) : staff.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground font-mono">@{s.staffCode}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="info">{roleLabel[s.role] ?? s.role}</Badge>
              <Badge variant={s.isActive ? 'success' : 'outline'}>
                {s.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(s)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Reset PIN" onClick={() => openResetPin(s)}>
                <KeyRound className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialog === 'create' || dialog === 'edit'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog === 'create' ? 'Add Staff Member' : 'Edit Staff'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={form.name} onChange={ff('name')} placeholder="e.g. John Silva" autoFocus />
            </div>
            {dialog === 'create' && (
              <div className="space-y-1.5">
                <Label>Username *</Label>
                <Input
                  value={form.staffCode}
                  onChange={(e) => setForm((s) => ({ ...s, staffCode: e.target.value }))}
                  placeholder="e.g. john_silva"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">Must be unique. Used to log in.</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={(v) => setForm((s) => ({ ...s, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {dialog === 'create' && (
              <>
                <div className="space-y-1.5">
                  <Label>PIN (4–6 digits) *</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={form.pin}
                    onChange={(e) => setForm((s) => ({ ...s, pin: e.target.value.replace(/\D/g, '') }))}
                    placeholder="••••"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm PIN *</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={form.confirmPin}
                    onChange={(e) => setForm((s) => ({ ...s, confirmPin: e.target.value.replace(/\D/g, '') }))}
                    placeholder="••••"
                  />
                </div>
              </>
            )}
            {dialog === 'edit' && (
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={saveStaff} disabled={saving}>
              {saving ? 'Saving...' : dialog === 'create' ? 'Create' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset PIN dialog */}
      <Dialog open={dialog === 'resetPin'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset PIN — {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>New PIN (4–6 digits)</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm New PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={confirmNewPin}
                onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={resetPin} disabled={saving}>
              {saving ? 'Resetting...' : 'Reset PIN'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Shortcuts Tab ────────────────────────────────────────────────────────────

const SHORTCUT_CATEGORIES = ['Navigation', 'POS'] as const

function ShortcutsTab() {
  const { shortcuts, updateShortcut, resetAll } = useShortcutsStore()
  const [recording, setRecording] = useState<string | null>(null)

  useEffect(() => {
    if (!recording) return

    function handler(e: KeyboardEvent) {
      e.preventDefault()
      e.stopPropagation()

      // Escape cancels
      if (e.key === 'Escape') { setRecording(null); return }

      // Ignore bare modifier key presses
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return

      // Build shortcut string
      let key = ''
      if (e.ctrlKey)  key += 'Ctrl+'
      if (e.altKey)   key += 'Alt+'
      if (e.shiftKey) key += 'Shift+'
      key += e.key

      updateShortcut(recording, key)
      setRecording(null)
      toast.success('Shortcut updated')
    }

    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [recording, updateShortcut])

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Click <strong>Change</strong> on any shortcut, then press the new key combination.
          Press <kbd className="px-1 py-0.5 text-xs rounded border border-border bg-muted font-mono">Esc</kbd> to cancel.
        </p>
        <Button variant="outline" size="sm" onClick={() => { resetAll(); toast.success('All shortcuts reset') }}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reset All
        </Button>
      </div>

      {SHORTCUT_CATEGORIES.map((cat) => {
        const items = shortcuts.filter((s) => s.category === cat)
        if (items.length === 0) return null
        return (
          <div key={cat}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</h3>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {items.map((sc) => (
                <div key={sc.id} className="flex items-center justify-between px-4 py-3 gap-4">
                  <p className="text-sm font-medium flex-1">{sc.label}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    {recording === sc.id ? (
                      <span className="text-xs text-primary animate-pulse font-medium">
                        Press new key combination…
                      </span>
                    ) : (
                      <kbd className="min-w-[3rem] text-center px-2 py-1 text-xs font-mono rounded border border-border bg-muted">
                        {sc.currentKey}
                      </kbd>
                    )}
                    <Button
                      variant={recording === sc.id ? 'destructive' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setRecording(recording === sc.id ? null : sc.id)}
                      disabled={!!recording && recording !== sc.id}
                    >
                      {recording === sc.id ? 'Cancel' : 'Change'}
                    </Button>
                    {sc.currentKey !== sc.defaultKey && recording !== sc.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title={`Reset to default (${sc.defaultKey})`}
                        onClick={() => updateShortcut(sc.id, sc.defaultKey)}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Fixed / context shortcuts — read-only reference */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Context Keys <span className="normal-case font-normal">(fixed, not configurable)</span>
        </h3>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {[
            { label: 'Login — move to PIN field',     key: 'Tab / Enter' },
            { label: 'Login — submit login',           key: 'Enter (PIN focused)' },
            { label: 'Payment — confirm sale',         key: 'Enter' },
            { label: 'Sale Complete — print receipt',  key: 'Enter' },
            { label: 'Any dialog — cancel / close',    key: 'Esc' },
          ].map(({ label, key }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3 gap-4">
              <p className="text-sm text-muted-foreground flex-1">{label}</p>
              <kbd className="min-w-[3rem] text-center px-2 py-1 text-xs font-mono rounded border border-border bg-muted/50 text-muted-foreground">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Backup Tab ──────────────────────────────────────────────────────────────

function BackupTab() {
  const [backingUp,  setBackingUp]  = useState(false)
  const [restoring,  setRestoring]  = useState(false)

  async function createBackup() {
    setBackingUp(true)
    try {
      const res = await api.backup.create()
      if (res.success) toast.success(`Backup saved to ${(res.data as { path: string })?.path ?? 'selected location'}`)
      else if (res.error !== 'Cancelled') toast.error(res.error ?? 'Backup failed')
    } catch { toast.error('Backup failed') }
    finally { setBackingUp(false) }
  }

  async function restoreBackup() {
    setRestoring(true)
    try {
      const res = await api.backup.restore()
      if (res.success) toast.success('Database restored successfully')
      else if (res.error !== 'Cancelled') toast.error(res.error ?? 'Restore failed')
    } catch { toast.error('Restore failed') }
    finally { setRestoring(false) }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        Create a full snapshot backup of your data — includes all products, sales, customers,
        company logo, and images. Restore from a backup to return the app to that exact state.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <HardDrive className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Create Full Backup</p>
              <p className="text-xs text-muted-foreground">Saves DB + logo + all images as a .zip</p>
            </div>
          </div>
          <Button className="w-full" onClick={createBackup} disabled={backingUp || restoring}>
            <HardDrive className="h-4 w-4 mr-2" />
            {backingUp ? 'Saving...' : 'Create Backup'}
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
              <Upload className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">Restore Backup</p>
              <p className="text-xs text-muted-foreground">Restore from a .zip or legacy .db file</p>
            </div>
          </div>
          <Button variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-50" onClick={restoreBackup} disabled={backingUp || restoring}>
            <Upload className="h-4 w-4 mr-2" />
            {restoring ? 'Restoring...' : 'Restore Backup'}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs text-amber-800">
          <strong>Warning:</strong> Restoring a backup will overwrite all current data. Make sure to create a backup first. Legacy <code>.db</code> backups from older versions are also supported.
        </p>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Tabs defaultValue="supermarket">
        <TabsList>
          <TabsTrigger value="supermarket">Supermarket</TabsTrigger>
          <TabsTrigger value="branch">Branch</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
        </TabsList>
        <TabsContent value="supermarket" className="mt-4">
          <SupermarketTab />
        </TabsContent>
        <TabsContent value="branch" className="mt-4">
          <BranchTab />
        </TabsContent>
        <TabsContent value="units" className="mt-4">
          <UnitsTab />
        </TabsContent>
        <TabsContent value="staff" className="mt-4">
          <StaffTab />
        </TabsContent>
        <TabsContent value="shortcuts" className="mt-4">
          <ShortcutsTab />
        </TabsContent>
        <TabsContent value="backup" className="mt-4">
          <BackupTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
