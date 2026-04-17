import { ipcMain } from 'electron'
import { eq, and, isNull, like, or, lte, gt } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../db/schema'

export function registerProductsIPC(): void {
  // products:getAll — all active products for a branch with inventory
  ipcMain.handle('products:getAll', async (_e, branchId: string) => {
    try {
      const db = getDb()
      const products = await db
        .select({
          id:           schema.products.id,
          branchId:     schema.products.branchId,
          categoryId:   schema.products.categoryId,
          unitId:       schema.products.unitId,
          name:         schema.products.name,
          nameSinhala:  schema.products.nameSinhala,
          nameTamil:    schema.products.nameTamil,
          sku:          schema.products.sku,
          barcode:      schema.products.barcode,
          costPrice:    schema.products.costPrice,
          sellingPrice: schema.products.sellingPrice,
          taxRate:      schema.products.taxRate,
          taxType:      schema.products.taxType,
          reorderLevel: schema.products.reorderLevel,
          isActive:     schema.products.isActive,
          hasExpiry:    schema.products.hasExpiry,
          expiryDate:   schema.products.expiryDate,
          createdAt:    schema.products.createdAt,
          updatedAt:    schema.products.updatedAt,
          qtyOnHand:    schema.inventory.qtyOnHand,
          categoryName: schema.categories.name,
          unitAbbr:     schema.units.abbreviation,
          unitName:     schema.units.name,
        })
        .from(schema.products)
        .leftJoin(schema.inventory, and(
          eq(schema.inventory.productId, schema.products.id),
          eq(schema.inventory.branchId, branchId)
        ))
        .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
        .leftJoin(schema.units, eq(schema.units.id, schema.products.unitId))
        .where(and(
          eq(schema.products.branchId, branchId),
          eq(schema.products.isActive, true),
          isNull(schema.products.deletedAt)
        ))

      return { success: true, data: products }
    } catch (err) {
      console.error('[products:getAll]', err)
      return { success: false, error: 'Failed to load products' }
    }
  })

  // products:getByBarcode — look up product by barcode (main + alternate barcodes)
  ipcMain.handle('products:getByBarcode', async (_e, barcode: string, branchId: string) => {
    try {
      const db = getDb()

      // Check main barcode
      const found = await db
        .select()
        .from(schema.products)
        .leftJoin(schema.inventory, and(
          eq(schema.inventory.productId, schema.products.id),
          eq(schema.inventory.branchId, branchId)
        ))
        .leftJoin(schema.units, eq(schema.units.id, schema.products.unitId))
        .where(and(
          eq(schema.products.barcode, barcode),
          eq(schema.products.branchId, branchId),
          eq(schema.products.isActive, true),
          isNull(schema.products.deletedAt)
        ))
        .limit(1)

      if (found.length > 0) {
        return {
          success: true,
          data: {
            ...found[0].products,
            qtyOnHand: found[0].inventory?.qtyOnHand ?? 0,
            unitAbbr: found[0].units?.abbreviation ?? 'pcs',
          }
        }
      }

      // Check alternate barcodes
      const altFound = await db
        .select()
        .from(schema.productBarcodes)
        .innerJoin(schema.products, eq(schema.products.id, schema.productBarcodes.productId))
        .leftJoin(schema.inventory, and(
          eq(schema.inventory.productId, schema.products.id),
          eq(schema.inventory.branchId, branchId)
        ))
        .leftJoin(schema.units, eq(schema.units.id, schema.products.unitId))
        .where(and(
          eq(schema.productBarcodes.barcode, barcode),
          eq(schema.productBarcodes.branchId, branchId),
          isNull(schema.productBarcodes.deletedAt)
        ))
        .limit(1)

      if (altFound.length > 0) {
        return {
          success: true,
          data: {
            ...altFound[0].products,
            qtyOnHand: altFound[0].inventory?.qtyOnHand ?? 0,
            unitAbbr: altFound[0].units?.abbreviation ?? 'pcs',
            packQty: altFound[0].product_barcodes.packQty,
          }
        }
      }

      return { success: true, data: null }
    } catch (err) {
      console.error('[products:getByBarcode]', err)
      return { success: false, error: 'Barcode lookup failed' }
    }
  })

  // products:search — fuzzy search by name/sku/barcode
  ipcMain.handle('products:search', async (_e, query: string, branchId: string) => {
    try {
      const db = getDb()
      const pattern = `%${query}%`
      const results = await db
        .select({
          id:           schema.products.id,
          name:         schema.products.name,
          sku:          schema.products.sku,
          barcode:      schema.products.barcode,
          sellingPrice: schema.products.sellingPrice,
          costPrice:    schema.products.costPrice,
          taxType:      schema.products.taxType,
          categoryId:   schema.products.categoryId,
          unitId:       schema.products.unitId,
          qtyOnHand:    schema.inventory.qtyOnHand,
          unitAbbr:     schema.units.abbreviation,
        })
        .from(schema.products)
        .leftJoin(schema.inventory, and(
          eq(schema.inventory.productId, schema.products.id),
          eq(schema.inventory.branchId, branchId)
        ))
        .leftJoin(schema.units, eq(schema.units.id, schema.products.unitId))
        .where(and(
          eq(schema.products.branchId, branchId),
          eq(schema.products.isActive, true),
          isNull(schema.products.deletedAt),
          or(
            like(schema.products.name, pattern),
            like(schema.products.sku, pattern),
            like(schema.products.barcode, pattern)
          )
        ))
        .limit(20)

      return { success: true, data: results }
    } catch (err) {
      console.error('[products:search]', err)
      return { success: false, error: 'Search failed' }
    }
  })

  // products:getById
  ipcMain.handle('products:getById', async (_e, id: string) => {
    try {
      const db = getDb()
      const found = await db
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, id))
        .limit(1)
      return { success: true, data: found[0] ?? null }
    } catch (err) {
      console.error('[products:getById]', err)
      return { success: false, error: 'Failed to load product' }
    }
  })

  // products:create
  ipcMain.handle('products:create', async (_e, data: {
    branchId: string; categoryId: string; unitId: string; name: string
    sku: string; barcode?: string; costPrice: number; sellingPrice: number
    taxType?: string; reorderLevel?: number; reorderQty?: number
    nameSinhala?: string; nameTamil?: string; description?: string
    wholesalePrice?: number; hasExpiry?: boolean
  }) => {
    try {
      const db = getDb()

      // Duplicate SKU check within the same branch
      const existing = await db
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(and(
          eq(schema.products.sku, data.sku.trim().toUpperCase()),
          eq(schema.products.branchId, data.branchId),
          isNull(schema.products.deletedAt)
        ))
        .limit(1)
      if (existing.length > 0) {
        return { success: false, error: `SKU "${data.sku}" already exists` }
      }

      // Duplicate barcode check
      if (data.barcode) {
        const barcodeConflict = await db
          .select({ id: schema.products.id })
          .from(schema.products)
          .where(and(
            eq(schema.products.barcode, data.barcode.trim()),
            eq(schema.products.branchId, data.branchId),
            isNull(schema.products.deletedAt)
          ))
          .limit(1)
        if (barcodeConflict.length > 0) {
          return { success: false, error: `Barcode "${data.barcode}" is already assigned to another product` }
        }
      }

      const id = crypto.randomUUID().replace(/-/g, '')
      await db.insert(schema.products).values({
        id,
        taxType: 'vat',
        reorderLevel: 0,
        reorderQty: 0,
        isActive: true,
        hasExpiry: false,
        costPrice: 0,
        ...data,
        sku: data.sku.trim().toUpperCase(),
      })
      // Create inventory record
      const invId = crypto.randomUUID().replace(/-/g, '')
      await db.insert(schema.inventory).values({
        id: invId,
        branchId: data.branchId,
        productId: id,
        qtyOnHand: 0,
        qtyReserved: 0,
      })
      return { success: true, data: { id } }
    } catch (err) {
      console.error('[products:create]', err)
      return { success: false, error: 'Failed to create product' }
    }
  })

  // products:update
  ipcMain.handle('products:update', async (_e, id: string, data: Record<string, unknown>) => {
    try {
      const db = getDb()

      // If SKU is being changed, check for duplicates in the same branch
      if (typeof data.sku === 'string' && typeof data.branchId === 'string') {
        const newSku = (data.sku as string).trim().toUpperCase()
        const conflict = await db
          .select({ id: schema.products.id })
          .from(schema.products)
          .where(and(
            eq(schema.products.sku, newSku),
            eq(schema.products.branchId, data.branchId as string),
            isNull(schema.products.deletedAt)
          ))
          .limit(1)
        if (conflict.length > 0 && conflict[0].id !== id) {
          return { success: false, error: `SKU "${data.sku}" already exists` }
        }
        data = { ...data, sku: newSku }
      }

      // Duplicate barcode check on update (exclude self)
      // Also: if barcode is changing, preserve old barcode as an alternate so
      // already-printed labels keep scanning correctly at POS.
      if (typeof data.barcode === 'string' && data.barcode.trim() && typeof data.branchId === 'string') {
        const newBarcode = (data.barcode as string).trim()

        const barcodeConflict = await db
          .select({ id: schema.products.id })
          .from(schema.products)
          .where(and(
            eq(schema.products.barcode, newBarcode),
            eq(schema.products.branchId, data.branchId as string),
            isNull(schema.products.deletedAt)
          ))
          .limit(1)
        if (barcodeConflict.length > 0 && barcodeConflict[0].id !== id) {
          return { success: false, error: `Barcode "${data.barcode}" is already assigned to another product` }
        }

        // If barcode is being changed, keep old barcode as alternate
        const current = await db
          .select({ barcode: schema.products.barcode })
          .from(schema.products)
          .where(eq(schema.products.id, id))
          .limit(1)
        const oldBarcode = current[0]?.barcode
        if (oldBarcode && oldBarcode !== newBarcode) {
          // Only insert if not already in product_barcodes
          const alreadyAlt = await db
            .select({ id: schema.productBarcodes.id })
            .from(schema.productBarcodes)
            .where(and(
              eq(schema.productBarcodes.productId, id),
              eq(schema.productBarcodes.barcode, oldBarcode),
              isNull(schema.productBarcodes.deletedAt)
            ))
            .limit(1)
          if (alreadyAlt.length === 0) {
            await db.insert(schema.productBarcodes).values({
              id:        crypto.randomUUID().replace(/-/g, ''),
              productId: id,
              branchId:  data.branchId as string,
              barcode:   oldBarcode,
              packQty:   1,
            })
          }
        }

        data = { ...data, barcode: newBarcode }
      }

      await db.update(schema.products)
        .set({ ...data, updatedAt: Date.now() } as never)
        .where(eq(schema.products.id, id))
      return { success: true }
    } catch (err) {
      console.error('[products:update]', err)
      return { success: false, error: 'Failed to update product' }
    }
  })

  // products:delete — soft delete
  ipcMain.handle('products:delete', async (_e, id: string) => {
    try {
      const db = getDb()
      await db.update(schema.products)
        .set({ deletedAt: Date.now(), updatedAt: Date.now(), isActive: false })
        .where(eq(schema.products.id, id))
      return { success: true }
    } catch (err) {
      console.error('[products:delete]', err)
      return { success: false, error: 'Failed to delete product' }
    }
  })

  // products:bulkImport — import products from CSV rows
  ipcMain.handle('products:bulkImport', async (_e, rows: Array<{
    name: string; sku: string; barcode?: string
    categoryName?: string; unitAbbr?: string
    costPrice?: number; sellingPrice: number; reorderLevel?: number
  }>, branchId: string) => {
    try {
      const db = getDb()
      const [cats, units] = await Promise.all([
        db.select({ id: schema.categories.id, name: schema.categories.name })
          .from(schema.categories)
          .where(and(eq(schema.categories.branchId, branchId), isNull(schema.categories.deletedAt))),
        db.select({ id: schema.units.id, abbreviation: schema.units.abbreviation })
          .from(schema.units)
          .where(and(eq(schema.units.branchId, branchId), isNull(schema.units.deletedAt))),
      ])
      const catMap  = new Map(cats.map((c)  => [c.name.toLowerCase(),          c.id]))
      const unitMap = new Map(units.map((u) => [u.abbreviation.toLowerCase(),  u.id]))

      let imported = 0; let skipped = 0
      const errors: string[] = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const lineNum = i + 2
        if (!row.name?.trim() || !row.sku?.trim()) {
          errors.push(`Row ${lineNum}: name and SKU are required`); skipped++; continue
        }
        if (!row.sellingPrice || isNaN(Number(row.sellingPrice))) {
          errors.push(`Row ${lineNum} (${row.sku}): invalid selling price`); skipped++; continue
        }
        const sku = row.sku.trim().toUpperCase()
        const existing = await db.select({ id: schema.products.id }).from(schema.products)
          .where(and(eq(schema.products.sku, sku), eq(schema.products.branchId, branchId), isNull(schema.products.deletedAt)))
          .limit(1)
        if (existing.length > 0) {
          errors.push(`Row ${lineNum} (${sku}): SKU already exists — skipped`); skipped++; continue
        }
        const categoryId = catMap.get((row.categoryName ?? '').toLowerCase()) ?? cats[0]?.id
        const unitId     = unitMap.get((row.unitAbbr    ?? '').toLowerCase()) ?? units[0]?.id
        if (!categoryId || !unitId) {
          errors.push(`Row ${lineNum} (${sku}): no categories/units in branch`); skipped++; continue
        }
        const id = crypto.randomUUID().replace(/-/g, '')
        await db.insert(schema.products).values({
          id, branchId, categoryId, unitId,
          name: row.name.trim(), sku,
          barcode:      row.barcode?.trim() || undefined,
          costPrice:    Number(row.costPrice)    || 0,
          sellingPrice: Number(row.sellingPrice),
          reorderLevel: Number(row.reorderLevel) || 0,
          reorderQty: 0, taxType: 'vat', isActive: true, hasExpiry: false,
        })
        await db.insert(schema.inventory).values({
          id: crypto.randomUUID().replace(/-/g, ''),
          branchId, productId: id, qtyOnHand: 0, qtyReserved: 0,
        })
        imported++
      }
      return { success: true, data: { imported, skipped, errors } }
    } catch (err) {
      console.error('[products:bulkImport]', err)
      return { success: false, error: 'Import failed' }
    }
  })

  // products:getExpiring — products expiring within N days
  ipcMain.handle('products:getExpiring', async (_e, branchId: string, daysAhead = 60) => {
    try {
      const db = getDb()
      const now = Date.now()
      const cutoff = now + daysAhead * 86400000
      const data = await db
        .select({
          id:           schema.products.id,
          name:         schema.products.name,
          sku:          schema.products.sku,
          barcode:      schema.products.barcode,
          expiryDate:   schema.products.expiryDate,
          categoryName: schema.categories.name,
          unitAbbr:     schema.units.abbreviation,
          qtyOnHand:    schema.inventory.qtyOnHand,
        })
        .from(schema.products)
        .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
        .leftJoin(schema.units, eq(schema.units.id, schema.products.unitId))
        .leftJoin(schema.inventory, and(
          eq(schema.inventory.productId, schema.products.id),
          eq(schema.inventory.branchId, branchId)
        ))
        .where(and(
          eq(schema.products.branchId, branchId),
          eq(schema.products.isActive, true),
          eq(schema.products.hasExpiry, true),
          isNull(schema.products.deletedAt),
          gt(schema.products.expiryDate, 0),
          lte(schema.products.expiryDate, cutoff)
        ))
        .orderBy(schema.products.expiryDate)
      return { success: true, data }
    } catch (err) {
      console.error('[products:getExpiring]', err)
      return { success: false, error: 'Failed to load expiring products' }
    }
  })

}
