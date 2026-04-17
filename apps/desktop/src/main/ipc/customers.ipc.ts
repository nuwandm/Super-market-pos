import { ipcMain } from 'electron'
import { eq, and, isNull, like, or, asc, desc, lt, sql } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../db/schema'

// ─── Shared helper: record a credit transaction + update customer balance ─────
async function recordCredit(opts: {
  customerId: string
  branchId: string
  staffId: string
  type: 'top_up' | 'sale' | 'settlement' | 'adjustment'
  amount: number   // positive = credit given, negative = credit spent
  referenceId?: string
  note?: string
}): Promise<number> {
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
    type:         opts.type,
    amount:       opts.amount,
    balanceAfter,
    referenceId:  opts.referenceId ?? null,
    staffId:      opts.staffId,
    note:         opts.note ?? null,
  })
  return balanceAfter
}

export function registerCustomersIPC(): void {
  // customers:getAll
  ipcMain.handle('customers:getAll', async (_e, branchId: string) => {
    try {
      const db = getDb()
      const data = await db
        .select()
        .from(schema.customers)
        .where(and(eq(schema.customers.branchId, branchId), isNull(schema.customers.deletedAt)))
        .orderBy(asc(schema.customers.name))
      return { success: true, data }
    } catch (err) {
      console.error('[customers:getAll]', err)
      return { success: false, error: 'Failed to load customers' }
    }
  })

  // customers:search
  ipcMain.handle('customers:search', async (_e, query: string, branchId: string) => {
    try {
      const db = getDb()
      const pattern = `%${query}%`
      const data = await db
        .select()
        .from(schema.customers)
        .where(and(
          eq(schema.customers.branchId, branchId),
          isNull(schema.customers.deletedAt),
          or(
            like(schema.customers.name, pattern),
            like(schema.customers.phone, pattern),
          )
        ))
        .orderBy(asc(schema.customers.name))
        .limit(20)
      return { success: true, data }
    } catch (err) {
      console.error('[customers:search]', err)
      return { success: false, error: 'Search failed' }
    }
  })

  // customers:getById — with recent purchase history
  ipcMain.handle('customers:getById', async (_e, id: string) => {
    try {
      const db = getDb()
      const customers = await db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.id, id))
        .limit(1)
      if (customers.length === 0) return { success: true, data: null }

      const recentSales = await db
        .select({
          id:            schema.sales.id,
          receiptNumber: schema.sales.receiptNumber,
          total:         schema.sales.total,
          status:        schema.sales.status,
          createdAt:     schema.sales.createdAt,
        })
        .from(schema.sales)
        .where(and(eq(schema.sales.customerId, id), isNull(schema.sales.deletedAt)))
        .orderBy(desc(schema.sales.createdAt))
        .limit(10)

      return { success: true, data: { ...customers[0], recentSales } }
    } catch (err) {
      console.error('[customers:getById]', err)
      return { success: false, error: 'Failed to load customer' }
    }
  })

  // customers:create
  ipcMain.handle('customers:create', async (_e, data: {
    branchId: string; name: string; phone: string; email?: string; address?: string
  }) => {
    try {
      const db = getDb()
      const phone = data.phone.trim()
      const existing = await db
        .select({ id: schema.customers.id })
        .from(schema.customers)
        .where(and(
          eq(schema.customers.phone, phone),
          eq(schema.customers.branchId, data.branchId),
          isNull(schema.customers.deletedAt)
        ))
        .limit(1)
      if (existing.length > 0) {
        return { success: false, error: `Phone number "${phone}" is already registered` }
      }
      const id = crypto.randomUUID().replace(/-/g, '')
      await db.insert(schema.customers).values({
        id,
        branchId:       data.branchId,
        name:           data.name.trim(),
        phone,
        email:          data.email?.trim() || null,
        address:        data.address?.trim() || null,
        loyaltyPoints:  0,
        creditBalance:  0,
        creditLimit:    (data as Record<string, unknown>).creditLimit != null ? Number((data as Record<string, unknown>).creditLimit) : 0,
        totalPurchases: 0,
        isActive:       true,
      })
      return { success: true, data: { id } }
    } catch (err) {
      console.error('[customers:create]', err)
      return { success: false, error: 'Failed to create customer' }
    }
  })

  // customers:update
  ipcMain.handle('customers:update', async (_e, id: string, data: Record<string, unknown>) => {
    try {
      const db = getDb()
      if (typeof data.phone === 'string' && typeof data.branchId === 'string') {
        const phone = data.phone.trim()
        const conflict = await db
          .select({ id: schema.customers.id })
          .from(schema.customers)
          .where(and(
            eq(schema.customers.phone, phone),
            eq(schema.customers.branchId, data.branchId as string),
            isNull(schema.customers.deletedAt)
          ))
          .limit(1)
        if (conflict.length > 0 && conflict[0].id !== id) {
          return { success: false, error: `Phone number "${data.phone}" is already registered` }
        }
        data = { ...data, phone }
      }
      await db.update(schema.customers)
        .set({ ...data, updatedAt: Date.now() } as never)
        .where(eq(schema.customers.id, id))
      return { success: true }
    } catch (err) {
      console.error('[customers:update]', err)
      return { success: false, error: 'Failed to update customer' }
    }
  })

  // customers:getCreditHistory
  ipcMain.handle('customers:getCreditHistory', async (_e, customerId: string) => {
    try {
      const db = getDb()
      const data = await db
        .select()
        .from(schema.creditTransactions)
        .where(eq(schema.creditTransactions.customerId, customerId))
        .orderBy(desc(schema.creditTransactions.createdAt))
        .limit(100)
      return { success: true, data }
    } catch (err) {
      console.error('[customers:getCreditHistory]', err)
      return { success: false, error: 'Failed to load credit history' }
    }
  })

  // customers:topUp — add pre-loaded wallet credit
  ipcMain.handle('customers:topUp', async (_e, data: {
    customerId: string; branchId: string; staffId: string; amount: number; note?: string
  }) => {
    try {
      if (data.amount <= 0) return { success: false, error: 'Amount must be positive' }
      const newBalance = await recordCredit({
        customerId: data.customerId,
        branchId:   data.branchId,
        staffId:    data.staffId,
        type:       'top_up',
        amount:     data.amount,
        note:       data.note,
      })
      return { success: true, data: { creditBalance: newBalance } }
    } catch (err) {
      console.error('[customers:topUp]', err)
      return { success: false, error: 'Top-up failed' }
    }
  })

  // customers:settle — receive payment against outstanding debt
  ipcMain.handle('customers:settle', async (_e, data: {
    customerId: string; branchId: string; staffId: string; amount: number; note?: string
  }) => {
    try {
      if (data.amount <= 0) return { success: false, error: 'Amount must be positive' }
      const newBalance = await recordCredit({
        customerId: data.customerId,
        branchId:   data.branchId,
        staffId:    data.staffId,
        type:       'settlement',
        amount:     data.amount,  // positive → reduces debt
        note:       data.note,
      })
      return { success: true, data: { creditBalance: newBalance } }
    } catch (err) {
      console.error('[customers:settle]', err)
      return { success: false, error: 'Settlement failed' }
    }
  })

  // customers:getCreditSummary — dashboard overview
  ipcMain.handle('customers:getCreditSummary', async (_e, branchId: string) => {
    try {
      const db = getDb()
      const [agg] = await db
        .select({
          totalWallet:  sql<number>`COALESCE(SUM(CASE WHEN ${schema.customers.creditBalance} > 0 THEN ${schema.customers.creditBalance} ELSE 0 END), 0)`,
          totalDebt:    sql<number>`COALESCE(SUM(CASE WHEN ${schema.customers.creditBalance} < 0 THEN ABS(${schema.customers.creditBalance}) ELSE 0 END), 0)`,
          debtorCount:  sql<number>`COUNT(CASE WHEN ${schema.customers.creditBalance} < 0 THEN 1 END)`,
          walletCount:  sql<number>`COUNT(CASE WHEN ${schema.customers.creditBalance} > 0 THEN 1 END)`,
        })
        .from(schema.customers)
        .where(and(eq(schema.customers.branchId, branchId), isNull(schema.customers.deletedAt)))

      const debtors = await db
        .select({
          id:            schema.customers.id,
          name:          schema.customers.name,
          phone:         schema.customers.phone,
          creditBalance: schema.customers.creditBalance,
        })
        .from(schema.customers)
        .where(and(
          eq(schema.customers.branchId, branchId),
          isNull(schema.customers.deletedAt),
          lt(schema.customers.creditBalance, 0),
        ))
        .orderBy(asc(schema.customers.creditBalance))
        .limit(8)

      return { success: true, data: { ...agg, debtors } }
    } catch (err) {
      console.error('[customers:getCreditSummary]', err)
      return { success: false, error: 'Failed to load credit summary' }
    }
  })

  // customers:adjustCredit — manual wallet deduction or addition (type = adjustment)
  ipcMain.handle('customers:adjustCredit', async (_e, data: {
    customerId: string; branchId: string; staffId: string; amount: number; note?: string
  }) => {
    try {
      if (data.amount === 0) return { success: false, error: 'Amount cannot be zero' }
      const newBalance = await recordCredit({
        customerId: data.customerId,
        branchId:   data.branchId,
        staffId:    data.staffId,
        type:       'adjustment',
        amount:     data.amount,  // negative = deduct from wallet, positive = add
        note:       data.note,
      })
      return { success: true, data: { creditBalance: newBalance } }
    } catch (err) {
      console.error('[customers:adjustCredit]', err)
      return { success: false, error: 'Adjustment failed' }
    }
  })

  // customers:delete — soft delete
  ipcMain.handle('customers:delete', async (_e, id: string) => {
    try {
      const db = getDb()
      await db.update(schema.customers)
        .set({ deletedAt: Date.now(), updatedAt: Date.now(), isActive: false })
        .where(eq(schema.customers.id, id))
      return { success: true }
    } catch (err) {
      console.error('[customers:delete]', err)
      return { success: false, error: 'Failed to delete customer' }
    }
  })
}
