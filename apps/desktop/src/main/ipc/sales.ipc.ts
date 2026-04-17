import { ipcMain } from 'electron'
import { eq, and, isNull, desc, like, gte, lte, sql } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../db/schema'

// ─── Credit helper ────────────────────────────────────────────────────────────
async function applyCredit(opts: {
  customerId: string; branchId: string; staffId: string
  amount: number; referenceId: string
}): Promise<void> {
  const db = getDb()
  const rows = await db
    .select({ creditBalance: schema.customers.creditBalance })
    .from(schema.customers)
    .where(eq(schema.customers.id, opts.customerId))
    .limit(1)
  const current = rows[0]?.creditBalance ?? 0
  const balanceAfter = current + opts.amount
  await db.update(schema.customers)
    .set({ creditBalance: balanceAfter, updatedAt: Date.now() })
    .where(eq(schema.customers.id, opts.customerId))
  await db.insert(schema.creditTransactions).values({
    id:           crypto.randomUUID().replace(/-/g, ''),
    customerId:   opts.customerId,
    branchId:     opts.branchId,
    type:         'sale',
    amount:       opts.amount,
    balanceAfter,
    referenceId:  opts.referenceId,
    staffId:      opts.staffId,
    note:         null,
  })
}

// Generate receipt number: {branchCode}-{YYYYMMDD}-{5digits}
async function generateReceiptNumber(branchId: string): Promise<string> {
  const db = getDb()
  const branch = await db
    .select({ branchCode: schema.branches.branchCode })
    .from(schema.branches)
    .where(eq(schema.branches.id, branchId))
    .limit(1)

  const code = branch[0]?.branchCode ?? 'MB'
  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`

  // Count today's sales
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const endOfDay = startOfDay + 86400000

  const count = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(schema.sales)
    .where(and(
      eq(schema.sales.branchId, branchId),
      gte(schema.sales.createdAt, startOfDay),
      lte(schema.sales.createdAt, endOfDay)
    ))

  const seq = String((count[0]?.cnt ?? 0) + 1).padStart(5, '0')
  return `${code}-${dateStr}-${seq}`
}

export function registerSalesIPC(): void {
  // sales:create — create full sale with items + payments + stock deduction
  ipcMain.handle('sales:create', async (_e, data: {
    branchId: string
    staffId: string
    customerId?: string
    items: Array<{
      productId: string
      productName: string
      barcode?: string
      qty: number
      unitPrice: number
      costPrice: number
      discountAmount: number
      taxAmount: number
      total: number
    }>
    subtotal: number
    discountAmount: number
    discountType?: string
    taxAmount: number
    total: number
    payments: Array<{ method: string; amount: number; reference?: string }>
    note?: string
  }) => {
    try {
      const db = getDb()

      // 0. Credit payment pre-check
      const creditPayment = data.payments.find((p) => p.method === 'credit')
      if (creditPayment && data.customerId) {
        const custRows = await db
          .select({ creditBalance: schema.customers.creditBalance, creditLimit: schema.customers.creditLimit })
          .from(schema.customers)
          .where(eq(schema.customers.id, data.customerId))
          .limit(1)
        if (custRows.length > 0) {
          const { creditBalance, creditLimit } = custRows[0]
          const newBalance = creditBalance - creditPayment.amount
          if (newBalance < -creditLimit) {
            const available = creditBalance + creditLimit
            return { success: false, error: `Insufficient credit. Available: ${available.toFixed(2)}` }
          }
        }
      } else if (creditPayment && !data.customerId) {
        return { success: false, error: 'A customer must be selected for credit payment' }
      }

      const saleId = crypto.randomUUID().replace(/-/g, '')
      const receiptNumber = await generateReceiptNumber(data.branchId)
      const now = Date.now()

      // 1. Create sale header
      await db.insert(schema.sales).values({
        id: saleId,
        branchId: data.branchId,
        receiptNumber,
        staffId: data.staffId,
        customerId: data.customerId,
        subtotal: data.subtotal,
        discountAmount: data.discountAmount,
        discountType: data.discountType,
        taxAmount: data.taxAmount,
        total: data.total,
        status: 'completed',
        note: data.note,
      })

      // 2. Create sale items + deduct inventory
      for (const item of data.items) {
        const itemId = crypto.randomUUID().replace(/-/g, '')
        await db.insert(schema.saleItems).values({
          id: itemId,
          saleId,
          branchId: data.branchId,
          ...item,
        })

        // Get current inventory
        const inv = await db
          .select()
          .from(schema.inventory)
          .where(and(
            eq(schema.inventory.productId, item.productId),
            eq(schema.inventory.branchId, data.branchId)
          ))
          .limit(1)

        if (inv.length > 0) {
          const qtyBefore = inv[0].qtyOnHand
          const qtyAfter = qtyBefore - item.qty

          // Update inventory
          await db.update(schema.inventory)
            .set({ qtyOnHand: qtyAfter, updatedAt: now })
            .where(eq(schema.inventory.id, inv[0].id))

          // Stock movement
          await db.insert(schema.stockMovements).values({
            id: crypto.randomUUID().replace(/-/g, ''),
            branchId: data.branchId,
            productId: item.productId,
            type: 'sale_out',
            referenceId: saleId,
            referenceType: 'sale',
            qtyBefore,
            qtyChange: -item.qty,
            qtyAfter,
            unitCost: item.costPrice,
            staffId: data.staffId,
          })
        }
      }

      // 3. Create payments
      for (const payment of data.payments) {
        await db.insert(schema.salePayments).values({
          id: crypto.randomUUID().replace(/-/g, ''),
          saleId,
          branchId: data.branchId,
          method: payment.method,
          amount: payment.amount,
          reference: payment.reference,
        })
      }

      // 4. Apply credit balance change + update totalPurchases if customer linked
      if (data.customerId) {
        if (creditPayment) {
          await applyCredit({
            customerId:  data.customerId,
            branchId:    data.branchId,
            staffId:     data.staffId,
            amount:      -creditPayment.amount,  // negative = credit spent
            referenceId: saleId,
          })
        }
        // Always update total purchases
        await db.update(schema.customers)
          .set({ totalPurchases: sql`total_purchases + ${data.total}`, updatedAt: now })
          .where(eq(schema.customers.id, data.customerId))
      }

      return { success: true, data: { id: saleId, receiptNumber } }
    } catch (err) {
      console.error('[sales:create]', err)
      return { success: false, error: 'Failed to create sale' }
    }
  })

  // sales:getById — full sale with items and payments
  ipcMain.handle('sales:getById', async (_e, id: string) => {
    try {
      const db = getDb()
      const sales = await db
        .select()
        .from(schema.sales)
        .where(eq(schema.sales.id, id))
        .limit(1)

      if (sales.length === 0) return { success: true, data: null }

      const items = await db
        .select()
        .from(schema.saleItems)
        .where(eq(schema.saleItems.saleId, id))

      const payments = await db
        .select()
        .from(schema.salePayments)
        .where(eq(schema.salePayments.saleId, id))

      return { success: true, data: { ...sales[0], items, payments } }
    } catch (err) {
      console.error('[sales:getById]', err)
      return { success: false, error: 'Failed to load sale' }
    }
  })

  // sales:getHistory — paginated with date filter
  ipcMain.handle('sales:getHistory', async (_e, branchId: string, filters: {
    from?: number; to?: number; staffId?: string; status?: string; limit?: number; offset?: number
  } = {}) => {
    try {
      const db = getDb()
      const conditions = [
        eq(schema.sales.branchId, branchId),
        isNull(schema.sales.deletedAt),
      ]
      if (filters.from) conditions.push(gte(schema.sales.createdAt, filters.from))
      if (filters.to)   conditions.push(lte(schema.sales.createdAt, filters.to))
      if (filters.staffId) conditions.push(eq(schema.sales.staffId, filters.staffId))
      if (filters.status)  conditions.push(eq(schema.sales.status, filters.status))

      const data = await db
        .select()
        .from(schema.sales)
        .where(and(...conditions))
        .orderBy(desc(schema.sales.createdAt))
        .limit(filters.limit ?? 50)
        .offset(filters.offset ?? 0)

      return { success: true, data }
    } catch (err) {
      console.error('[sales:getHistory]', err)
      return { success: false, error: 'Failed to load sales history' }
    }
  })

  // sales:void — soft void with reason (manager action)
  ipcMain.handle('sales:void', async (_e, id: string, reason: string) => {
    try {
      const db = getDb()

      const sale = await db.select().from(schema.sales).where(eq(schema.sales.id, id)).limit(1)
      if (sale.length === 0) return { success: false, error: 'Sale not found' }
      if (sale[0].status === 'voided') return { success: false, error: 'Sale is already voided' }

      // Restore inventory
      const items = await db.select().from(schema.saleItems).where(eq(schema.saleItems.saleId, id))
      for (const item of items) {
        const inv = await db
          .select()
          .from(schema.inventory)
          .where(and(
            eq(schema.inventory.productId, item.productId),
            eq(schema.inventory.branchId, sale[0].branchId)
          ))
          .limit(1)

        if (inv.length > 0) {
          const qtyBefore = inv[0].qtyOnHand
          const qtyAfter = qtyBefore + item.qty
          await db.update(schema.inventory)
            .set({ qtyOnHand: qtyAfter, updatedAt: Date.now() })
            .where(eq(schema.inventory.id, inv[0].id))
          await db.insert(schema.stockMovements).values({
            id: crypto.randomUUID().replace(/-/g, ''),
            branchId: sale[0].branchId,
            productId: item.productId,
            type: 'return_in',
            referenceId: id,
            referenceType: 'void',
            qtyBefore,
            qtyChange: item.qty,
            qtyAfter,
            staffId: sale[0].staffId,
            note: `Void: ${reason}`,
          })
        }
      }

      // Update sale status
      await db.update(schema.sales)
        .set({ status: 'voided', note: `VOIDED: ${reason}`, updatedAt: Date.now() })
        .where(eq(schema.sales.id, id))

      return { success: true }
    } catch (err) {
      console.error('[sales:void]', err)
      return { success: false, error: 'Failed to void sale' }
    }
  })

  // sales:openSession — open cashier shift
  ipcMain.handle('sales:openSession', async (_e, staffId: string, branchId: string, openingFloat: number) => {
    try {
      const db = getDb()
      // Check for existing open session
      const existing = await db
        .select()
        .from(schema.cashSessions)
        .where(and(
          eq(schema.cashSessions.staffId, staffId),
          eq(schema.cashSessions.branchId, branchId),
          eq(schema.cashSessions.status, 'open')
        ))
        .limit(1)

      if (existing.length > 0) {
        return { success: true, data: existing[0] }
      }

      const id = crypto.randomUUID().replace(/-/g, '')
      await db.insert(schema.cashSessions).values({
        id,
        branchId,
        staffId,
        openedAt: Date.now(),
        openingFloat,
        status: 'open',
      })

      const session = await db.select().from(schema.cashSessions).where(eq(schema.cashSessions.id, id)).limit(1)
      return { success: true, data: session[0] }
    } catch (err) {
      console.error('[sales:openSession]', err)
      return { success: false, error: 'Failed to open session' }
    }
  })

  // sales:closeSession
  ipcMain.handle('sales:closeSession', async (_e, sessionId: string, closingCash: number) => {
    try {
      const db = getDb()
      const sessions = await db
        .select()
        .from(schema.cashSessions)
        .where(eq(schema.cashSessions.id, sessionId))
        .limit(1)

      if (sessions.length === 0) return { success: false, error: 'Session not found' }

      const session = sessions[0]
      // Calculate expected cash: opening float + all cash payments
      const cashPayments = await db
        .select({ total: sql<number>`sum(amount)` })
        .from(schema.salePayments)
        .innerJoin(schema.sales, eq(schema.sales.id, schema.salePayments.saleId))
        .where(and(
          eq(schema.salePayments.branchId, session.branchId),
          eq(schema.salePayments.method, 'cash'),
          eq(schema.sales.status, 'completed'),
          gte(schema.sales.createdAt, session.openedAt)
        ))

      const expectedCash = session.openingFloat + (cashPayments[0]?.total ?? 0)
      const cashVariance = closingCash - expectedCash

      await db.update(schema.cashSessions)
        .set({
          closedAt: Date.now(),
          closingCash,
          expectedCash,
          cashVariance,
          status: 'closed',
          updatedAt: Date.now(),
        })
        .where(eq(schema.cashSessions.id, sessionId))

      return { success: true, data: { expectedCash, cashVariance } }
    } catch (err) {
      console.error('[sales:closeSession]', err)
      return { success: false, error: 'Failed to close session' }
    }
  })

  // sales:getCurrentSession
  ipcMain.handle('sales:getCurrentSession', async (_e, staffId: string, branchId: string) => {
    try {
      const db = getDb()
      const data = await db
        .select()
        .from(schema.cashSessions)
        .where(and(
          eq(schema.cashSessions.staffId, staffId),
          eq(schema.cashSessions.branchId, branchId),
          eq(schema.cashSessions.status, 'open')
        ))
        .limit(1)
      return { success: true, data: data[0] ?? null }
    } catch (err) {
      console.error('[sales:getCurrentSession]', err)
      return { success: false, error: 'Failed to get session' }
    }
  })

  // sales:createReturn — partial or full return of a completed sale
  ipcMain.handle('sales:createReturn', async (_e, data: {
    originalSaleId: string
    branchId: string
    staffId: string
    items: Array<{
      productId: string
      productName: string
      qty: number
      unitPrice: number
      costPrice: number
      total: number
    }>
    reason: string
  }) => {
    try {
      const db = getDb()
      const orig = await db.select().from(schema.sales).where(eq(schema.sales.id, data.originalSaleId)).limit(1)
      if (orig.length === 0) return { success: false, error: 'Original sale not found' }

      const returnId = crypto.randomUUID().replace(/-/g, '')
      const subtotal  = data.items.reduce((s, i) => s + i.total, 0)
      const now       = Date.now()

      await db.insert(schema.sales).values({
        id:             returnId,
        branchId:       data.branchId,
        receiptNumber:  `RET-${orig[0].receiptNumber}`,
        staffId:        data.staffId,
        subtotal:       -subtotal,
        discountAmount: 0,
        taxAmount:      0,
        total:          -subtotal,
        status:         'returned',
        note:           `Return of #${orig[0].receiptNumber}: ${data.reason}`,
      })

      for (const item of data.items) {
        await db.insert(schema.saleItems).values({
          id:             crypto.randomUUID().replace(/-/g, ''),
          saleId:         returnId,
          branchId:       data.branchId,
          productId:      item.productId,
          productName:    item.productName,
          qty:            -item.qty,
          unitPrice:      item.unitPrice,
          costPrice:      item.costPrice,
          discountAmount: 0,
          taxAmount:      0,
          total:          -item.total,
        })

        const inv = await db
          .select()
          .from(schema.inventory)
          .where(and(eq(schema.inventory.productId, item.productId), eq(schema.inventory.branchId, data.branchId)))
          .limit(1)

        if (inv.length > 0) {
          const qtyBefore = inv[0].qtyOnHand
          const qtyAfter  = qtyBefore + item.qty
          await db.update(schema.inventory)
            .set({ qtyOnHand: qtyAfter, updatedAt: now })
            .where(eq(schema.inventory.id, inv[0].id))
          await db.insert(schema.stockMovements).values({
            id:            crypto.randomUUID().replace(/-/g, ''),
            branchId:      data.branchId,
            productId:     item.productId,
            type:          'return_in',
            referenceId:   returnId,
            referenceType: 'return',
            qtyBefore,
            qtyChange:     item.qty,
            qtyAfter,
            staffId:       data.staffId,
            note:          `Return: ${data.reason}`,
          })
        }
      }

      return { success: true, data: { id: returnId, receiptNumber: `RET-${orig[0].receiptNumber}` } }
    } catch (err) {
      console.error('[sales:createReturn]', err)
      return { success: false, error: 'Failed to process return' }
    }
  })

  // sales:getSessionReport — full EOD summary for a cash session
  ipcMain.handle('sales:getSessionReport', async (_e, sessionId: string) => {
    try {
      const db = getDb()
      const sessions = await db.select().from(schema.cashSessions).where(eq(schema.cashSessions.id, sessionId)).limit(1)
      if (sessions.length === 0) return { success: false, error: 'Session not found' }
      const sess = sessions[0]
      const endTs = sess.closedAt ?? Date.now()

      const [salesData, paymentsData, returnData] = await Promise.all([
        db.select({
          totalSales:        sql<number>`COALESCE(sum(${schema.sales.total}), 0)`,
          totalTransactions: sql<number>`count(*)`,
          totalDiscount:     sql<number>`COALESCE(sum(${schema.sales.discountAmount}), 0)`,
          totalTax:          sql<number>`COALESCE(sum(${schema.sales.taxAmount}), 0)`,
        })
        .from(schema.sales)
        .where(and(
          eq(schema.sales.branchId, sess.branchId),
          eq(schema.sales.status, 'completed'),
          gte(schema.sales.createdAt, sess.openedAt),
          lte(schema.sales.createdAt, endTs),
        )),
        db.select({
          method: schema.salePayments.method,
          total:  sql<number>`COALESCE(sum(${schema.salePayments.amount}), 0)`,
        })
        .from(schema.salePayments)
        .innerJoin(schema.sales, eq(schema.sales.id, schema.salePayments.saleId))
        .where(and(
          eq(schema.sales.branchId, sess.branchId),
          eq(schema.sales.status, 'completed'),
          gte(schema.sales.createdAt, sess.openedAt),
          lte(schema.sales.createdAt, endTs),
        ))
        .groupBy(schema.salePayments.method),
        db.select({ total: sql<number>`COALESCE(sum(${schema.sales.total}), 0)`, count: sql<number>`count(*)` })
          .from(schema.sales)
          .where(and(
            eq(schema.sales.branchId, sess.branchId),
            eq(schema.sales.status, 'returned'),
            gte(schema.sales.createdAt, sess.openedAt),
            lte(schema.sales.createdAt, endTs),
          )),
      ])

      const s   = salesData[0]
      const pay = Object.fromEntries(paymentsData.map((p) => [p.method, p.total]))

      return {
        success: true,
        data: {
          session:           sess,
          totalSales:        s?.totalSales        ?? 0,
          totalTransactions: s?.totalTransactions ?? 0,
          totalDiscount:     s?.totalDiscount     ?? 0,
          totalTax:          s?.totalTax          ?? 0,
          cashSales:         pay['cash']          ?? 0,
          cardSales:         pay['card']          ?? 0,
          mobileSales:       pay['mobile_pay']    ?? 0,
          totalReturns:      returnData[0]?.total ?? 0,
          returnCount:       returnData[0]?.count ?? 0,
        },
      }
    } catch (err) {
      console.error('[sales:getSessionReport]', err)
      return { success: false, error: 'Failed to load session report' }
    }
  })

  // sales:getDailySummary — dashboard quick stats
  ipcMain.handle('sales:getDailySummary', async (_e, branchId: string, date?: number) => {
    try {
      const db = getDb()
      const targetDate = date ? new Date(date) : new Date()
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime()
      const endOfDay   = startOfDay + 86400000

      const baseWhere = and(
        eq(schema.sales.branchId, branchId),
        eq(schema.sales.status, 'completed'),
        gte(schema.sales.createdAt, startOfDay),
        lte(schema.sales.createdAt, endOfDay)
      )

      const [summaryRows, paymentRows] = await Promise.all([
        db.select({
          totalSales:    sql<number>`COALESCE(sum(${schema.sales.total}), 0)`,
          totalTransactions: sql<number>`count(*)`,
          totalDiscount: sql<number>`COALESCE(sum(${schema.sales.discountAmount}), 0)`,
          totalTax:      sql<number>`COALESCE(sum(${schema.sales.taxAmount}), 0)`,
        })
        .from(schema.sales)
        .where(baseWhere),

        db.select({
          method: schema.salePayments.method,
          total:  sql<number>`COALESCE(sum(${schema.salePayments.amount}), 0)`,
        })
        .from(schema.salePayments)
        .innerJoin(schema.sales, eq(schema.sales.id, schema.salePayments.saleId))
        .where(baseWhere)
        .groupBy(schema.salePayments.method),
      ])

      const s   = summaryRows[0]
      const pay = Object.fromEntries(paymentRows.map((p) => [p.method, p.total]))
      const totalSales        = s?.totalSales        ?? 0
      const totalTransactions = s?.totalTransactions ?? 0

      return {
        success: true,
        data: {
          date:                    new Date(startOfDay).toISOString().split('T')[0],
          totalSales,
          totalTransactions,
          totalCash:               pay['cash']        ?? 0,
          totalCard:               pay['card']        ?? 0,
          totalMobilePay:          pay['mobile_pay']  ?? 0,
          totalDiscount:           s?.totalDiscount   ?? 0,
          totalTax:                s?.totalTax        ?? 0,
          averageTransactionValue: totalTransactions > 0 ? totalSales / totalTransactions : 0,
        },
      }
    } catch (err) {
      console.error('[sales:getDailySummary]', err)
      return { success: false, error: 'Failed to load summary' }
    }
  })
}
