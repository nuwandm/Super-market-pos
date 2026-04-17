import { ipcMain } from 'electron'
import { eq, and, isNull, lte, asc, desc } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../db/schema'

export function registerInventoryIPC(): void {
  // inventory:getAll — all inventory records with product info
  ipcMain.handle('inventory:getAll', async (_e, branchId: string) => {
    try {
      const db = getDb()
      const data = await db
        .select({
          id:           schema.inventory.id,
          branchId:     schema.inventory.branchId,
          productId:    schema.inventory.productId,
          qtyOnHand:    schema.inventory.qtyOnHand,
          qtyReserved:  schema.inventory.qtyReserved,
          lastCountedAt: schema.inventory.lastCountedAt,
          updatedAt:    schema.inventory.updatedAt,
          productName:  schema.products.name,
          productSku:   schema.products.sku,
          productBarcode: schema.products.barcode,
          sellingPrice: schema.products.sellingPrice,
          costPrice:    schema.products.costPrice,
          reorderLevel: schema.products.reorderLevel,
          categoryId:   schema.products.categoryId,
          categoryName: schema.categories.name,
          unitAbbr:     schema.units.abbreviation,
        })
        .from(schema.inventory)
        .innerJoin(schema.products, and(
          eq(schema.products.id, schema.inventory.productId),
          eq(schema.products.isActive, true),
          isNull(schema.products.deletedAt)
        ))
        .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
        .leftJoin(schema.units, eq(schema.units.id, schema.products.unitId))
        .where(and(
          eq(schema.inventory.branchId, branchId),
          isNull(schema.inventory.deletedAt)
        ))
        .orderBy(asc(schema.products.name))
      return { success: true, data }
    } catch (err) {
      console.error('[inventory:getAll]', err)
      return { success: false, error: 'Failed to load inventory' }
    }
  })

  // inventory:getLowStock
  ipcMain.handle('inventory:getLowStock', async (_e, branchId: string) => {
    try {
      const db = getDb()
      const data = await db
        .select({
          productId:    schema.inventory.productId,
          qtyOnHand:    schema.inventory.qtyOnHand,
          productName:  schema.products.name,
          reorderLevel: schema.products.reorderLevel,
          reorderQty:   schema.products.reorderQty,
          unitAbbr:     schema.units.abbreviation,
        })
        .from(schema.inventory)
        .innerJoin(schema.products, and(
          eq(schema.products.id, schema.inventory.productId),
          eq(schema.products.isActive, true),
          isNull(schema.products.deletedAt)
        ))
        .leftJoin(schema.units, eq(schema.units.id, schema.products.unitId))
        .where(and(
          eq(schema.inventory.branchId, branchId),
          lte(schema.inventory.qtyOnHand, schema.products.reorderLevel)
        ))
        .orderBy(asc(schema.inventory.qtyOnHand))
      return { success: true, data }
    } catch (err) {
      console.error('[inventory:getLowStock]', err)
      return { success: false, error: 'Failed to load low stock' }
    }
  })

  // inventory:adjust — manual stock adjustment
  ipcMain.handle('inventory:adjust', async (_e, productId: string, qty: number, type: string, reason: string, staffId: string, branchId: string) => {
    try {
      const db = getDb()

      // Get current inventory
      const inv = await db
        .select()
        .from(schema.inventory)
        .where(and(
          eq(schema.inventory.productId, productId),
          eq(schema.inventory.branchId, branchId)
        ))
        .limit(1)

      if (inv.length === 0) return { success: false, error: 'Product inventory not found' }

      const current = inv[0]
      const qtyBefore = current.qtyOnHand
      const qtyChange = type.includes('out') ? -Math.abs(qty) : Math.abs(qty)
      const qtyAfter = qtyBefore + qtyChange

      // Update inventory
      await db.update(schema.inventory)
        .set({ qtyOnHand: qtyAfter, updatedAt: Date.now() })
        .where(eq(schema.inventory.id, current.id))

      // Record movement
      await db.insert(schema.stockMovements).values({
        id: crypto.randomUUID().replace(/-/g, ''),
        branchId,
        productId,
        type,
        qtyBefore,
        qtyChange,
        qtyAfter,
        staffId,
        note: reason,
      })

      return { success: true }
    } catch (err) {
      console.error('[inventory:adjust]', err)
      return { success: false, error: 'Failed to adjust stock' }
    }
  })

  // inventory:getMovements — movement history for a product
  ipcMain.handle('inventory:getMovements', async (_e, productId: string, branchId: string) => {
    try {
      const db = getDb()
      const data = await db
        .select()
        .from(schema.stockMovements)
        .where(and(
          eq(schema.stockMovements.productId, productId),
          eq(schema.stockMovements.branchId, branchId)
        ))
        .orderBy(desc(schema.stockMovements.createdAt))
        .limit(100)
      return { success: true, data }
    } catch (err) {
      console.error('[inventory:getMovements]', err)
      return { success: false, error: 'Failed to load stock movements' }
    }
  })
}
