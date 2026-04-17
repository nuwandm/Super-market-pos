import { ipcMain } from 'electron'
import { eq, and, isNull, asc } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../db/schema'

export function registerSuppliersIPC(): void {
  // suppliers:getAll
  ipcMain.handle('suppliers:getAll', async (_e, branchId: string) => {
    try {
      const db = getDb()
      const data = await db
        .select()
        .from(schema.suppliers)
        .where(and(eq(schema.suppliers.branchId, branchId), isNull(schema.suppliers.deletedAt)))
        .orderBy(asc(schema.suppliers.name))
      return { success: true, data }
    } catch (err) {
      console.error('[suppliers:getAll]', err)
      return { success: false, error: 'Failed to load suppliers' }
    }
  })

  // suppliers:create
  ipcMain.handle('suppliers:create', async (_e, data: {
    branchId: string; name: string; contactPerson?: string
    phone?: string; email?: string; address?: string; taxNumber?: string
  }) => {
    try {
      const db = getDb()
      const id = crypto.randomUUID().replace(/-/g, '')
      await db.insert(schema.suppliers).values({ id, isActive: true, ...data })
      return { success: true, data: { id } }
    } catch (err) {
      console.error('[suppliers:create]', err)
      return { success: false, error: 'Failed to create supplier' }
    }
  })

  // suppliers:update
  ipcMain.handle('suppliers:update', async (_e, id: string, data: Record<string, unknown>) => {
    try {
      const db = getDb()
      await db.update(schema.suppliers)
        .set({ ...data, updatedAt: Date.now() } as never)
        .where(eq(schema.suppliers.id, id))
      return { success: true }
    } catch (err) {
      console.error('[suppliers:update]', err)
      return { success: false, error: 'Failed to update supplier' }
    }
  })

  // suppliers:delete — soft delete
  ipcMain.handle('suppliers:delete', async (_e, id: string) => {
    try {
      const db = getDb()
      await db.update(schema.suppliers)
        .set({ deletedAt: Date.now(), updatedAt: Date.now(), isActive: false })
        .where(eq(schema.suppliers.id, id))
      return { success: true }
    } catch (err) {
      console.error('[suppliers:delete]', err)
      return { success: false, error: 'Failed to delete supplier' }
    }
  })
}
