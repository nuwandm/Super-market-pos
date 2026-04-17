import { ipcMain } from 'electron'
import { eq, and, isNull, gte, lte, sql, desc } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../db/schema'

export function registerReportsIPC(): void {
  // reports:getSalesSummary — revenue, transactions, profit, discount, tax
  ipcMain.handle('reports:getSalesSummary', async (_e, branchId: string, from: number, to: number) => {
    try {
      const db = getDb()

      const summary = await db
        .select({
          totalRevenue:      sql<number>`COALESCE(sum(${schema.sales.total}), 0)`,
          totalTransactions: sql<number>`count(*)`,
          totalDiscount:     sql<number>`COALESCE(sum(${schema.sales.discountAmount}), 0)`,
          totalTax:          sql<number>`COALESCE(sum(${schema.sales.taxAmount}), 0)`,
        })
        .from(schema.sales)
        .where(and(
          eq(schema.sales.branchId, branchId),
          eq(schema.sales.status, 'completed'),
          isNull(schema.sales.deletedAt),
          gte(schema.sales.createdAt, from),
          lte(schema.sales.createdAt, to),
        ))

      const cogs = await db
        .select({
          totalCost: sql<number>`COALESCE(sum(${schema.saleItems.costPrice} * ${schema.saleItems.qty}), 0)`,
        })
        .from(schema.saleItems)
        .innerJoin(schema.sales, eq(schema.sales.id, schema.saleItems.saleId))
        .where(and(
          eq(schema.sales.branchId, branchId),
          eq(schema.sales.status, 'completed'),
          isNull(schema.sales.deletedAt),
          gte(schema.sales.createdAt, from),
          lte(schema.sales.createdAt, to),
        ))

      const s = summary[0]
      const totalRevenue      = s?.totalRevenue      ?? 0
      const totalTransactions = s?.totalTransactions ?? 0
      const totalCost         = cogs[0]?.totalCost   ?? 0

      return {
        success: true,
        data: {
          totalRevenue,
          totalTransactions,
          totalDiscount:       s?.totalDiscount ?? 0,
          totalTax:            s?.totalTax ?? 0,
          totalCost,
          grossProfit:         totalRevenue - totalCost,
          avgTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
        },
      }
    } catch (err) {
      console.error('[reports:getSalesSummary]', err)
      return { success: false, error: 'Failed to load summary' }
    }
  })

  // reports:getDailyBreakdown — one row per calendar day
  ipcMain.handle('reports:getDailyBreakdown', async (_e, branchId: string, from: number, to: number) => {
    try {
      const db = getDb()
      const dayExpr = sql<string>`date(${schema.sales.createdAt} / 1000, 'unixepoch', 'localtime')`
      const rows = await db
        .select({
          day:   dayExpr,
          total: sql<number>`COALESCE(sum(${schema.sales.total}), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(schema.sales)
        .where(and(
          eq(schema.sales.branchId, branchId),
          eq(schema.sales.status, 'completed'),
          isNull(schema.sales.deletedAt),
          gte(schema.sales.createdAt, from),
          lte(schema.sales.createdAt, to),
        ))
        .groupBy(dayExpr)
        .orderBy(dayExpr)
      return { success: true, data: rows }
    } catch (err) {
      console.error('[reports:getDailyBreakdown]', err)
      return { success: false, error: 'Failed to load daily breakdown' }
    }
  })

  // reports:getTopProducts — top N by revenue
  ipcMain.handle('reports:getTopProducts', async (_e, branchId: string, from: number, to: number, limit = 10) => {
    try {
      const db = getDb()
      const rows = await db
        .select({
          productId:   schema.saleItems.productId,
          productName: schema.saleItems.productName,
          qtySold:     sql<number>`COALESCE(sum(${schema.saleItems.qty}), 0)`,
          revenue:     sql<number>`COALESCE(sum(${schema.saleItems.total}), 0)`,
          profit:      sql<number>`COALESCE(sum(${schema.saleItems.total} - ${schema.saleItems.costPrice} * ${schema.saleItems.qty}), 0)`,
        })
        .from(schema.saleItems)
        .innerJoin(schema.sales, eq(schema.sales.id, schema.saleItems.saleId))
        .where(and(
          eq(schema.sales.branchId, branchId),
          eq(schema.sales.status, 'completed'),
          isNull(schema.sales.deletedAt),
          gte(schema.sales.createdAt, from),
          lte(schema.sales.createdAt, to),
        ))
        .groupBy(schema.saleItems.productId, schema.saleItems.productName)
        .orderBy(desc(sql`sum(${schema.saleItems.total})`))
        .limit(limit)
      return { success: true, data: rows }
    } catch (err) {
      console.error('[reports:getTopProducts]', err)
      return { success: false, error: 'Failed to load top products' }
    }
  })

  // reports:getProfitByCategory
  ipcMain.handle('reports:getProfitByCategory', async (_e, branchId: string, from: number, to: number) => {
    try {
      const db = getDb()
      const rows = await db
        .select({
          categoryId:   schema.products.categoryId,
          categoryName: schema.categories.name,
          revenue:      sql<number>`COALESCE(sum(${schema.saleItems.total}), 0)`,
          cost:         sql<number>`COALESCE(sum(${schema.saleItems.costPrice} * ${schema.saleItems.qty}), 0)`,
          profit:       sql<number>`COALESCE(sum(${schema.saleItems.total} - ${schema.saleItems.costPrice} * ${schema.saleItems.qty}), 0)`,
          qtySold:      sql<number>`COALESCE(sum(${schema.saleItems.qty}), 0)`,
        })
        .from(schema.saleItems)
        .innerJoin(schema.sales, eq(schema.sales.id, schema.saleItems.saleId))
        .innerJoin(schema.products, eq(schema.products.id, schema.saleItems.productId))
        .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
        .where(and(
          eq(schema.sales.branchId, branchId),
          eq(schema.sales.status, 'completed'),
          isNull(schema.sales.deletedAt),
          gte(schema.sales.createdAt, from),
          lte(schema.sales.createdAt, to),
        ))
        .groupBy(schema.products.categoryId, schema.categories.name)
        .orderBy(desc(sql`sum(${schema.saleItems.total} - ${schema.saleItems.costPrice} * ${schema.saleItems.qty})`))
      return { success: true, data: rows }
    } catch (err) {
      console.error('[reports:getProfitByCategory]', err)
      return { success: false, error: 'Failed to load profit by category' }
    }
  })

  // reports:getPaymentBreakdown — cash vs card vs mobile etc.
  ipcMain.handle('reports:getPaymentBreakdown', async (_e, branchId: string, from: number, to: number) => {
    try {
      const db = getDb()
      const rows = await db
        .select({
          method: schema.salePayments.method,
          total:  sql<number>`COALESCE(sum(${schema.salePayments.amount}), 0)`,
          count:  sql<number>`count(*)`,
        })
        .from(schema.salePayments)
        .innerJoin(schema.sales, eq(schema.sales.id, schema.salePayments.saleId))
        .where(and(
          eq(schema.sales.branchId, branchId),
          eq(schema.sales.status, 'completed'),
          isNull(schema.sales.deletedAt),
          gte(schema.sales.createdAt, from),
          lte(schema.sales.createdAt, to),
        ))
        .groupBy(schema.salePayments.method)
        .orderBy(desc(sql`sum(${schema.salePayments.amount})`))
      return { success: true, data: rows }
    } catch (err) {
      console.error('[reports:getPaymentBreakdown]', err)
      return { success: false, error: 'Failed to load payment breakdown' }
    }
  })
}
