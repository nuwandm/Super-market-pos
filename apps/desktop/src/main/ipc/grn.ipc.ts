import { ipcMain } from 'electron'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../db/schema'

interface GRNItemInput {
  productId: string
  qtyOrdered: number
  qtyReceived: number
  unitCost: number
}

export function registerGRNIPC(): void {
  // grn:getAll — list GRNs with supplier name
  ipcMain.handle('grn:getAll', async (_e, branchId: string) => {
    try {
      const db = getDb()
      const data = await db
        .select({
          id:            schema.grn.id,
          branchId:      schema.grn.branchId,
          supplierId:    schema.grn.supplierId,
          supplierName:  schema.suppliers.name,
          invoiceNumber: schema.grn.invoiceNumber,
          receivedAt:    schema.grn.receivedAt,
          totalCost:     schema.grn.totalCost,
          status:        schema.grn.status,
          note:          schema.grn.note,
          staffId:       schema.grn.staffId,
          createdAt:     schema.grn.createdAt,
        })
        .from(schema.grn)
        .leftJoin(schema.suppliers, eq(schema.suppliers.id, schema.grn.supplierId))
        .where(and(
          eq(schema.grn.branchId, branchId),
          isNull(schema.grn.deletedAt)
        ))
        .orderBy(desc(schema.grn.receivedAt))
        .limit(200)
      return { success: true, data }
    } catch (err) {
      console.error('[grn:getAll]', err)
      return { success: false, error: 'Failed to load GRNs' }
    }
  })

  // grn:getById — full GRN with items + product info
  ipcMain.handle('grn:getById', async (_e, id: string) => {
    try {
      const db = getDb()
      const [grnRow] = await db
        .select({
          id:            schema.grn.id,
          branchId:      schema.grn.branchId,
          supplierId:    schema.grn.supplierId,
          supplierName:  schema.suppliers.name,
          invoiceNumber: schema.grn.invoiceNumber,
          receivedAt:    schema.grn.receivedAt,
          totalCost:     schema.grn.totalCost,
          status:        schema.grn.status,
          note:          schema.grn.note,
          staffId:       schema.grn.staffId,
          createdAt:     schema.grn.createdAt,
        })
        .from(schema.grn)
        .leftJoin(schema.suppliers, eq(schema.suppliers.id, schema.grn.supplierId))
        .where(eq(schema.grn.id, id))
        .limit(1)

      if (!grnRow) return { success: false, error: 'GRN not found' }

      const items = await db
        .select({
          id:          schema.grnItems.id,
          grnId:       schema.grnItems.grnId,
          productId:   schema.grnItems.productId,
          productName: schema.products.name,
          productSku:  schema.products.sku,
          unitAbbr:    schema.units.abbreviation,
          qtyOrdered:  schema.grnItems.qtyOrdered,
          qtyReceived: schema.grnItems.qtyReceived,
          unitCost:    schema.grnItems.unitCost,
          totalCost:   schema.grnItems.totalCost,
        })
        .from(schema.grnItems)
        .leftJoin(schema.products, eq(schema.products.id, schema.grnItems.productId))
        .leftJoin(schema.units, eq(schema.units.id, schema.products.unitId))
        .where(eq(schema.grnItems.grnId, id))

      return { success: true, data: { ...grnRow, items } }
    } catch (err) {
      console.error('[grn:getById]', err)
      return { success: false, error: 'Failed to load GRN' }
    }
  })

  // grn:create — create GRN + items + update inventory + record movements
  ipcMain.handle('grn:create', async (_e, payload: {
    branchId: string
    supplierId?: string
    invoiceNumber?: string
    receivedAt: number
    note?: string
    staffId: string
    updateCostPrice: boolean
    items: GRNItemInput[]
  }) => {
    try {
      const db = getDb()

      if (!payload.items || payload.items.length === 0) {
        return { success: false, error: 'GRN must have at least one item' }
      }

      const grnId = crypto.randomUUID().replace(/-/g, '')
      let totalCost = 0

      // Process each item
      for (const item of payload.items) {
        if (item.qtyReceived <= 0) continue
        totalCost += item.qtyReceived * item.unitCost
      }

      // Insert GRN header
      await db.insert(schema.grn).values({
        id:            grnId,
        branchId:      payload.branchId,
        supplierId:    payload.supplierId ?? null,
        invoiceNumber: payload.invoiceNumber ?? null,
        receivedAt:    payload.receivedAt,
        totalCost,
        status:        'received',
        note:          payload.note ?? null,
        staffId:       payload.staffId,
      })

      // Insert items + update inventory
      for (const item of payload.items) {
        if (item.qtyReceived <= 0) continue

        const itemId = crypto.randomUUID().replace(/-/g, '')
        await db.insert(schema.grnItems).values({
          id:          itemId,
          grnId,
          branchId:    payload.branchId,
          productId:   item.productId,
          qtyOrdered:  item.qtyOrdered,
          qtyReceived: item.qtyReceived,
          unitCost:    item.unitCost,
          totalCost:   item.qtyReceived * item.unitCost,
        })

        // Get current inventory
        const [inv] = await db
          .select()
          .from(schema.inventory)
          .where(and(
            eq(schema.inventory.productId, item.productId),
            eq(schema.inventory.branchId, payload.branchId)
          ))
          .limit(1)

        const qtyBefore = inv?.qtyOnHand ?? 0
        const qtyAfter  = qtyBefore + item.qtyReceived

        if (inv) {
          await db.update(schema.inventory)
            .set({ qtyOnHand: qtyAfter, updatedAt: Date.now() })
            .where(eq(schema.inventory.id, inv.id))
        } else {
          // No inventory record yet — create one
          await db.insert(schema.inventory).values({
            id:       crypto.randomUUID().replace(/-/g, ''),
            branchId: payload.branchId,
            productId: item.productId,
            qtyOnHand: qtyAfter,
            qtyReserved: 0,
          })
        }

        // Stock movement
        await db.insert(schema.stockMovements).values({
          id:            crypto.randomUUID().replace(/-/g, ''),
          branchId:      payload.branchId,
          productId:     item.productId,
          type:          'grn_in',
          referenceId:   grnId,
          referenceType: 'grn',
          qtyBefore,
          qtyChange:     item.qtyReceived,
          qtyAfter,
          unitCost:      item.unitCost,
          staffId:       payload.staffId,
          note:          payload.invoiceNumber ? `GRN ${payload.invoiceNumber}` : 'GRN received',
        })

        // Optionally update product cost price
        if (payload.updateCostPrice && item.unitCost > 0) {
          await db.update(schema.products)
            .set({ costPrice: item.unitCost, updatedAt: Date.now() } as never)
            .where(eq(schema.products.id, item.productId))
        }
      }

      return { success: true, data: { id: grnId } }
    } catch (err) {
      console.error('[grn:create]', err)
      return { success: false, error: 'Failed to create GRN' }
    }
  })
}
