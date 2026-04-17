import { ipcMain } from 'electron'
import { eq, and, isNull, asc } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../db/schema'

export function registerCategoriesIPC(): void {
  ipcMain.handle('categories:getAll', async (_e, branchId: string) => {
    try {
      const db = getDb()
      const data = await db
        .select()
        .from(schema.categories)
        .where(and(
          eq(schema.categories.branchId, branchId),
          isNull(schema.categories.deletedAt)
        ))
        .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name))
      return { success: true, data }
    } catch (err) {
      console.error('[categories:getAll]', err)
      return { success: false, error: 'Failed to load categories' }
    }
  })

  ipcMain.handle('categories:create', async (_e, data: {
    branchId: string; name: string; parentId?: string; sortOrder?: number
  }) => {
    try {
      const db = getDb()
      const id = crypto.randomUUID().replace(/-/g, '')
      await db.insert(schema.categories).values({
        id,
        sortOrder: 0,
        isActive: true,
        ...data,
      })
      return { success: true, data: { id } }
    } catch (err) {
      console.error('[categories:create]', err)
      return { success: false, error: 'Failed to create category' }
    }
  })

  ipcMain.handle('categories:update', async (_e, id: string, data: Record<string, unknown>) => {
    try {
      const db = getDb()
      await db.update(schema.categories)
        .set({ ...data, updatedAt: Date.now() } as never)
        .where(eq(schema.categories.id, id))
      return { success: true }
    } catch (err) {
      console.error('[categories:update]', err)
      return { success: false, error: 'Failed to update category' }
    }
  })

  ipcMain.handle('categories:delete', async (_e, id: string) => {
    try {
      const db = getDb()
      await db.update(schema.categories)
        .set({ deletedAt: Date.now(), updatedAt: Date.now() })
        .where(eq(schema.categories.id, id))
      return { success: true }
    } catch (err) {
      console.error('[categories:delete]', err)
      return { success: false, error: 'Failed to delete category' }
    }
  })
}
