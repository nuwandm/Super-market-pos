import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import type { Category } from '@pos/shared-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface FormState {
  name: string
  parentId: string
  sortOrder: string
  isActive: boolean
}

const defaultForm: FormState = { name: '', parentId: 'none', sortOrder: '0', isActive: true }

export default function CategoriesPage() {
  const { session } = useAuthStore()
  const branchId = session?.branchId ?? ''

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<'create' | 'edit' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    try {
      const res = await api.categories.getAll(branchId)
      if (res.success) setCategories(res.data ?? [])
    } catch { toast.error('Failed to load categories') }
    finally { setLoading(false) }
  }, [branchId])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm(defaultForm)
    setDialog('create')
  }

  function openEdit(cat: Category) {
    setEditing(cat)
    setForm({
      name:      cat.name,
      parentId:  cat.parentId ?? 'none',
      sortOrder: String(cat.sortOrder),
      isActive:  cat.isActive,
    })
    setDialog('edit')
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const data = {
        branchId,
        name:      form.name.trim(),
        parentId:  form.parentId === 'none' ? null : form.parentId,
        sortOrder: parseInt(form.sortOrder) || 0,
        isActive:  form.isActive,
      }
      const res = dialog === 'create'
        ? await api.categories.create(data)
        : await api.categories.update(editing!.id, data)
      if (!res.success) { toast.error(res.error ?? 'Failed to save'); return }
      toast.success(dialog === 'create' ? 'Category created' : 'Category updated')
      setDialog(null)
      await load()
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  async function deleteCategory() {
    if (!deleteTarget) return
    try {
      const res = await api.categories.delete(deleteTarget.id)
      if (!res.success) { toast.error(res.error ?? 'Failed to delete'); return }
      toast.success('Category deleted')
      setDeleteTarget(null)
      await load()
    } catch { toast.error('Delete failed') }
  }

  const topLevel = categories.filter((c) => !c.parentId)
  const parentMap = new Map(categories.map((c) => [c.id, c]))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Add Category
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map((i) => <div key={i} className="h-14 rounded-lg border border-border bg-card animate-pulse" />)}
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center text-sm text-muted-foreground">
          No categories yet. Create one to get started.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {categories.sort((a, b) => a.sortOrder - b.sortOrder).map((cat) => (
            <div key={cat.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                {cat.parentId && <div className="w-4 border-l-2 border-muted-foreground/30 ml-2" />}
                <div>
                  <p className="text-sm font-medium">{cat.name}</p>
                  {cat.parentId && (
                    <p className="text-xs text-muted-foreground">
                      under {parentMap.get(cat.parentId)?.name ?? cat.parentId}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={cat.isActive ? 'success' : 'outline'}>
                  {cat.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(cat)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog === 'create' ? 'New Category' : 'Edit Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Beverages"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Parent Category</Label>
              <Select value={form.parentId} onValueChange={(v) => setForm((f) => ({ ...f, parentId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Top level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top level)</SelectItem>
                  {topLevel
                    .filter((c) => !editing || c.id !== editing.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving...' : dialog === 'create' ? 'Create' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{deleteTarget?.name}"? Products in this category will not be deleted but will need a new category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteCategory}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
