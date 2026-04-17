import { ipcMain, BrowserWindow } from 'electron'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../db/schema'

function buildReceiptHtml(d: {
  receiptNumber: string
  shopName: string
  shopAddress?: string | null
  shopPhone?: string | null
  branchName: string
  cashierName: string
  createdAt: number
  items: Array<{ productName: string; qty: number; unitPrice: number; discountAmount: number; total: number }>
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  payments: Array<{ method: string; amount: number }>
  currency: string
  receiptHeader?: string | null
  receiptFooter?: string | null
}): string {
  const fmt = (n: number) => `${d.currency} ${n.toFixed(2)}`
  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })

  const itemRows = d.items.map((i) => `
    <tr>
      <td class="name">${i.productName}</td>
      <td class="r">${i.qty}</td>
      <td class="r">${fmt(i.unitPrice)}</td>
      <td class="r">${fmt(i.total)}</td>
    </tr>
    ${i.discountAmount > 0 ? `<tr><td colspan="4" class="disc"> Discount: -${fmt(i.discountAmount)}</td></tr>` : ''}
  `).join('')

  const payRows = d.payments.map((p) =>
    `<tr><td>${p.method.replace(/_/g, ' ').toUpperCase()}</td><td class="r">${fmt(p.amount)}</td></tr>`
  ).join('')

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Receipt</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',monospace; font-size:12px; width:76mm; padding:6px; }
  .c  { text-align:center; }
  .r  { text-align:right; }
  .b  { font-weight:bold; }
  .sm { font-size:10px; }
  hr  { border:none; border-top:1px dashed #000; margin:5px 0; }
  table { width:100%; border-collapse:collapse; }
  th  { font-weight:bold; font-size:10px; border-bottom:1px solid #000; padding:2px 0; }
  td  { padding:1px 0; vertical-align:top; }
  .name { max-width:32mm; }
  .disc { font-size:10px; color:#555; padding-left:4px; }
  .total-line td { font-weight:bold; font-size:14px; border-top:1px solid #000; padding-top:3px; }
  @media print { @page { margin:0; size:80mm auto; } }
</style></head>
<body>
  <div class="c">
    ${d.receiptHeader ? `<p class="sm">${d.receiptHeader.replace(/\n/g, '<br>')}</p><hr>` : ''}
    <p class="b" style="font-size:14px">${d.shopName}</p>
    ${d.shopAddress ? `<p class="sm">${d.shopAddress}</p>` : ''}
    ${d.shopPhone   ? `<p class="sm">Tel: ${d.shopPhone}</p>` : ''}
    <p class="sm">${d.branchName}</p>
  </div>
  <hr>
  <p>Receipt: <span class="b">${d.receiptNumber}</span></p>
  <p class="sm">Date: ${fmtDate(d.createdAt)}</p>
  <p class="sm">Cashier: ${d.cashierName}</p>
  <hr>
  <table>
    <thead><tr>
      <th style="text-align:left">Item</th>
      <th class="r" style="width:20px">Qty</th>
      <th class="r" style="width:52px">Price</th>
      <th class="r" style="width:52px">Total</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <hr>
  <table>
    <tr><td>Subtotal</td><td class="r">${fmt(d.subtotal)}</td></tr>
    ${d.discountAmount > 0 ? `<tr><td>Discount</td><td class="r">-${fmt(d.discountAmount)}</td></tr>` : ''}
    ${d.taxAmount > 0      ? `<tr><td>VAT</td><td class="r">${fmt(d.taxAmount)}</td></tr>`           : ''}
    <tr class="total-line"><td>TOTAL</td><td class="r">${fmt(d.total)}</td></tr>
  </table>
  <hr>
  <p class="b sm">Payment</p>
  <table>${payRows}</table>
  <hr>
  ${d.receiptFooter ? `<p class="c sm">${d.receiptFooter.replace(/\n/g, '<br>')}</p>` : ''}
  <p class="c sm" style="margin-top:4px">Thank you for shopping with us!</p>
  <hr>
  <p class="c" style="font-size:9px;color:#999;margin-top:4px;line-height:1.6">
    Software by <strong style="color:#777">Dream Labs IT Solutions</strong><br>
    WhatsApp: 070 615 1051
  </p>
  <br><br>
</body></html>`
}

export function registerReceiptIPC(): void {
  ipcMain.handle('receipt:print', async (_e, saleId: string) => {
    try {
      const db = getDb()

      const sales = await db
        .select()
        .from(schema.sales)
        .where(eq(schema.sales.id, saleId))
        .limit(1)
      if (sales.length === 0) return { success: false, error: 'Sale not found' }
      const sale = sales[0]

      const [items, payments, branches, staffList] = await Promise.all([
        db.select().from(schema.saleItems).where(eq(schema.saleItems.saleId, saleId)),
        db.select().from(schema.salePayments).where(eq(schema.salePayments.saleId, saleId)),
        db.select().from(schema.branches).where(eq(schema.branches.id, sale.branchId)).limit(1),
        db.select({ name: schema.staff.name }).from(schema.staff).where(eq(schema.staff.id, sale.staffId)).limit(1),
      ])

      const branch = branches[0]
      const cashier = staffList[0]

      // Always fetch the supermarket that belongs to this branch
      const supermarketRows = branch?.supermarketId
        ? await db.select().from(schema.supermarkets).where(eq(schema.supermarkets.id, branch.supermarketId)).limit(1)
        : await db.select().from(schema.supermarkets).limit(1)
      const supermarket = supermarketRows[0]

      const html = buildReceiptHtml({
        receiptNumber:  sale.receiptNumber,
        shopName:       supermarket?.name        ?? 'Supermarket POS',
        shopAddress:    supermarket?.address,
        shopPhone:      supermarket?.phone,
        branchName:     branch?.name             ?? '',
        cashierName:    cashier?.name            ?? '',
        createdAt:      sale.createdAt,
        items:          items.map((i) => ({
          productName:    i.productName,
          qty:            i.qty,
          unitPrice:      i.unitPrice,
          discountAmount: i.discountAmount,
          total:          i.total,
        })),
        subtotal:       sale.subtotal,
        discountAmount: sale.discountAmount,
        taxAmount:      sale.taxAmount,
        total:          sale.total,
        payments:       payments.map((p) => ({ method: p.method, amount: p.amount })),
        currency:       supermarket?.currency    ?? 'LKR',
        receiptHeader:  branch?.receiptHeader    ?? supermarket?.receiptHeader,
        receiptFooter:  branch?.receiptFooter    ?? supermarket?.receiptFooter,
      })

      const win = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      })
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      win.webContents.print({ silent: true, printBackground: true }, (_ok, reason) => {
        if (reason) console.error('[receipt:print]', reason)
        win.close()
      })

      return { success: true }
    } catch (err) {
      console.error('[receipt:print]', err)
      return { success: false, error: 'Failed to print receipt' }
    }
  })
}
