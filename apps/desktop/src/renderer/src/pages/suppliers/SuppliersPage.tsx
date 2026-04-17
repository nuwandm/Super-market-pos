import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search, Building2, Phone, Mail } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import type { Supplier } from '@pos/shared-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'

interface FormState {
  name: string; contactPerson: string; phone: string
  email: string; address: string; taxNumber: string; isActive: boolean
}
const defaultForm: FormState = {
  name: '', contactPerson: '', phone: '', email: '', address: '', taxNumber: '', isActive: true,
}

export default function SuppliersPage() {
  const { session } = useAuthStore()
  const branchId = session?.branchId ?? ''

  const [suppliers,    setSuppliers]    = useState<Supplier[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [dialog,       setDialog]       = useState<'create' | 'edit' | null>(null)
  const [editing,      setEditing]      = useState<Supplier | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)
  const [form,         setForm]         = useState<FormState>(defaultForm)
  const [saving,       setSaving]       = useState(false)

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const res = await api.suppliers.getAll(branchId)
      if (res.success) setSuppliers(res.data ?? [])
    } catch { toast.error('Failed to load suppliers') }
    finally { setLoading(false) }
  }, [branchId])

  useEffect(() => { load() }, [load])

  function f<K extends keyof FormState>(key: K) {
    return (v: FormState[K]) => setForm((s) => ({ ...s, [key]: v }))
  }

  function openCreate() {
    setEditing(null); setForm(defaultForm); setDialog('create')
  }
  function openEdit(s: Supplier) {
    setEditing(s)
    setForm({
      name: s.name, contactPerson: s.contactPerson ?? '', phone: s.phone ?? '',
      email: s.email ?? '', address: s.address ?? '', taxNumber: s.taxNumber ?? '',
      isActive: s.isActive,
    })
    setDialog('edit')
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Supplier name is required'); return }
    setSaving(true)
    try {
      const data = {
        branchId,
        name:          form.name.trim(),
        contactPerson: form.contactPerson.trim() || undefined,
        phone:         form.phone.trim() || undefined,
        email:         form.email.trim() || undefined,
        address:       form.address.trim() || undefined,
        taxNumber:     form.taxNumber.trim() || undefined,
        isActive:      form.isActive,
      }
      const res = dialog === 'create'
        ? await api.suppliers.create(data)
        : await api.suppliers.update(editing!.id, data)
      if (!res.success) { toast.error(res.error ?? 'Failed to save'); return }
      toast.success(dialog === 'create' ? 'Supplier added' : 'Supplier updated')
      setDialog(null)
      await load()
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  async function deleteSupplier() {
    if (!deleteTarget) return
    try {
      const res = await api.suppliers.delete(deleteTarget.id)
      if (!res.success) { toast.error(res.error ?? 'Failed to delete'); return }
      toast.success('Supplier deleted')
      setDeleteTarget(null)
      await load()
    } catch { toast.error('Delete failed') }
  }

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase()
    return !q || s.name.toLowerCase().includes(q) ||
      (s.phone ?? '').includes(q) || (s.contactPerson ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Suppliers</h1>
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
          <Plus className="h-4 w-4 mr-2" /> Add Supplier
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-x-4 px-4 py-2 border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <span>Supplier</span><span>Contact</span><span>Phone</span><span>Status</span><span />
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {[1,2,3].map((i) => <div key={i} className="h-14 animate-pulse bg-card" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {search ? 'No suppliers match your search' : 'No suppliers yet. Add one to get started.'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((s) => (
              <div key={s.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-x-4 items-center px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    {s.taxNumber && <p className="text-xs text-muted-foreground font-mono">VAT: {s.taxNumber}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  {s.contactPerson || '—'}
                </div>
                <div className="space-y-0.5">
                  {s.phone && (
                    <p className="text-sm flex items-center gap-1">
                      <Phone className="h-3 w-3 text-muted-foreground" />{s.phone}
                    </p>
                  )}
                  {s.email && (
                    <p className="text-xs flex items-center gap-1 text-muted-foreground">
                      <Mail className="h-3 w-3" />{s.email}
                    </p>
                  )}
                  {!s.phone && !s.email && <span className="text-muted-foreground text-sm">—</span>}
                </div>
                <Badge variant={s.isActive ? 'success' : 'outline'}>
                  {s.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(s)}>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog === 'create' ? 'New Supplier' : 'Edit Supplier'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-1">
            <div className="col-span-2 space-y-1.5">
              <Label>Company / Supplier Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => f('name')(e.target.value)}
                placeholder="e.g. ABC Distributors (Pvt) Ltd"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Person</Label>
              <Input value={form.contactPerson} onChange={(e) => f('contactPerson')(e.target.value)} placeholder="e.g. Kamal Silva" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => f('phone')(e.target.value)} placeholder="e.g. 0112345678" type="tel" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => f('email')(e.target.value)} placeholder="optional" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label>VAT / Tax Number</Label>
              <Input value={form.taxNumber} onChange={(e) => f('taxNumber')(e.target.value)} placeholder="optional" className="font-mono" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => f('address')(e.target.value)} placeholder="optional" />
            </div>
            <div className="col-span-2 flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.isActive} onCheckedChange={f('isActive')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving...' : dialog === 'create' ? 'Add Supplier' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{deleteTarget?.name}"? Existing GRNs will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteSupplier}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
