import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ─── Sync columns (added to every syncable table) ─────────────────────────────
const syncCols = {
  syncId:      text('sync_id').default(sql`(lower(hex(randomblob(16))))`).notNull(),
  deviceId:    text('device_id'),
  syncedAt:    integer('synced_at'),
  syncVersion: integer('sync_version').default(0).notNull(),
  deletedAt:   integer('deleted_at'),
  createdAt:   integer('created_at').default(sql`(unixepoch('now') * 1000)`).notNull(),
  updatedAt:   integer('updated_at').default(sql`(unixepoch('now') * 1000)`).notNull(),
}

// ─── Owner Entity ─────────────────────────────────────────────────────────────

export const supermarkets = sqliteTable('supermarkets', {
  id:              text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  name:            text('name').notNull(),
  phone:           text('phone'),
  email:           text('email'),
  address:         text('address'),
  currency:        text('currency').default('LKR').notNull(),
  timezone:        text('timezone').default('Asia/Colombo').notNull(),
  taxRate:         real('tax_rate').default(0).notNull(),
  vatNumber:       text('vat_number'),
  receiptHeader:   text('receipt_header'),
  receiptFooter:   text('receipt_footer'),
  receiptLanguage: text('receipt_language').default('en').notNull(),
  ...syncCols,
})

// ─── Branch ───────────────────────────────────────────────────────────────────

export const branches = sqliteTable('branches', {
  id:             text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  supermarketId:  text('supermarket_id').notNull(),
  name:           text('name').notNull(),
  branchCode:     text('branch_code').notNull(),
  phone:          text('phone'),
  address:        text('address'),
  taxRate:        real('tax_rate'),
  receiptHeader:  text('receipt_header'),
  receiptFooter:  text('receipt_footer'),
  isActive:       integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  ...syncCols,
})

// ─── Staff ────────────────────────────────────────────────────────────────────

export const staff = sqliteTable('staff', {
  id:        text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:  text('branch_id').notNull(),
  name:      text('name').notNull(),
  staffCode: text('staff_code').notNull(),
  role:      text('role').notNull(),
  pinHash:   text('pin_hash').notNull(),
  pinSalt:   text('pin_salt').notNull(),
  isActive:  integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  ...syncCols,
})

// ─── Catalog ─────────────────────────────────────────────────────────────────

export const categories = sqliteTable('categories', {
  id:        text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:  text('branch_id').notNull(),
  name:      text('name').notNull(),
  parentId:  text('parent_id'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive:  integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  ...syncCols,
})

export const units = sqliteTable('units', {
  id:           text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:     text('branch_id').notNull(),
  name:         text('name').notNull(),
  abbreviation: text('abbreviation').notNull(),
  isDecimal:    integer('is_decimal', { mode: 'boolean' }).default(false).notNull(),
  ...syncCols,
})

export const products = sqliteTable('products', {
  id:             text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:       text('branch_id').notNull(),
  categoryId:     text('category_id').notNull(),
  unitId:         text('unit_id').notNull(),
  name:           text('name').notNull(),
  nameSinhala:    text('name_sinhala'),
  nameTamil:      text('name_tamil'),
  sku:            text('sku').notNull(),
  barcode:        text('barcode'),
  costPrice:      real('cost_price').default(0).notNull(),
  sellingPrice:   real('selling_price').notNull(),
  wholesalePrice: real('wholesale_price'),
  taxRate:        real('tax_rate'),
  taxType:        text('tax_type').default('vat').notNull(),
  reorderLevel:   real('reorder_level').default(0).notNull(),
  reorderQty:     real('reorder_qty').default(0).notNull(),
  hasExpiry:      integer('has_expiry', { mode: 'boolean' }).default(false).notNull(),
  expiryDate:     integer('expiry_date'),
  isActive:       integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  imageUrl:       text('image_url'),
  description:    text('description'),
  ...syncCols,
})

export const productBarcodes = sqliteTable('product_barcodes', {
  id:        text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  productId: text('product_id').notNull(),
  branchId:  text('branch_id').notNull(),
  barcode:   text('barcode').notNull(),
  packQty:   real('pack_qty').default(1).notNull(),
  ...syncCols,
})

// ─── Inventory ────────────────────────────────────────────────────────────────

export const inventory = sqliteTable('inventory', {
  id:            text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:      text('branch_id').notNull(),
  productId:     text('product_id').notNull(),
  qtyOnHand:     real('qty_on_hand').default(0).notNull(),
  qtyReserved:   real('qty_reserved').default(0).notNull(),
  lastCountedAt: integer('last_counted_at'),
  ...syncCols,
})

export const stockMovements = sqliteTable('stock_movements', {
  id:            text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:      text('branch_id').notNull(),
  productId:     text('product_id').notNull(),
  type:          text('type').notNull(),
  referenceId:   text('reference_id'),
  referenceType: text('reference_type'),
  qtyBefore:     real('qty_before').notNull(),
  qtyChange:     real('qty_change').notNull(),
  qtyAfter:      real('qty_after').notNull(),
  unitCost:      real('unit_cost'),
  staffId:       text('staff_id').notNull(),
  note:          text('note'),
  batchNumber:   text('batch_number'),
  expiryDate:    integer('expiry_date'),
  ...syncCols,
})

// ─── Sales ────────────────────────────────────────────────────────────────────

export const sales = sqliteTable('sales', {
  id:             text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:       text('branch_id').notNull(),
  receiptNumber:  text('receipt_number').notNull(),
  staffId:        text('staff_id').notNull(),
  customerId:     text('customer_id'),
  subtotal:       real('subtotal').notNull(),
  discountAmount: real('discount_amount').default(0).notNull(),
  discountType:   text('discount_type'),
  taxAmount:      real('tax_amount').default(0).notNull(),
  total:          real('total').notNull(),
  status:         text('status').default('completed').notNull(),
  note:           text('note'),
  ...syncCols,
})

export const saleItems = sqliteTable('sale_items', {
  id:             text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  saleId:         text('sale_id').notNull(),
  branchId:       text('branch_id').notNull(),
  productId:      text('product_id').notNull(),
  productName:    text('product_name').notNull(),
  barcode:        text('barcode'),
  qty:            real('qty').notNull(),
  unitPrice:      real('unit_price').notNull(),
  costPrice:      real('cost_price').notNull(),
  discountAmount: real('discount_amount').default(0).notNull(),
  taxAmount:      real('tax_amount').default(0).notNull(),
  total:          real('total').notNull(),
  ...syncCols,
})

export const salePayments = sqliteTable('sale_payments', {
  id:        text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  saleId:    text('sale_id').notNull(),
  branchId:  text('branch_id').notNull(),
  method:    text('method').notNull(),
  amount:    real('amount').notNull(),
  reference: text('reference'),
  ...syncCols,
})

export const cashSessions = sqliteTable('cash_sessions', {
  id:            text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:      text('branch_id').notNull(),
  staffId:       text('staff_id').notNull(),
  openedAt:      integer('opened_at').notNull(),
  closedAt:      integer('closed_at'),
  openingFloat:  real('opening_float').notNull(),
  closingCash:   real('closing_cash'),
  expectedCash:  real('expected_cash'),
  cashVariance:  real('cash_variance'),
  status:        text('status').default('open').notNull(),
  note:          text('note'),
  ...syncCols,
})

// ─── Customers ────────────────────────────────────────────────────────────────

export const customers = sqliteTable('customers', {
  id:             text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:       text('branch_id').notNull(),
  name:           text('name').notNull(),
  phone:          text('phone').notNull(),
  email:          text('email'),
  address:        text('address'),
  loyaltyPoints:  real('loyalty_points').default(0).notNull(),
  creditBalance:  real('credit_balance').default(0).notNull(),
  creditLimit:    real('credit_limit').default(0).notNull(),
  totalPurchases: real('total_purchases').default(0).notNull(),
  isActive:       integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  ...syncCols,
})

export const creditTransactions = sqliteTable('credit_transactions', {
  id:           text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  customerId:   text('customer_id').notNull(),
  branchId:     text('branch_id').notNull(),
  type:         text('type').notNull(),   // top_up | sale | settlement | adjustment
  amount:       real('amount').notNull(), // positive = credit added, negative = credit used
  balanceAfter: real('balance_after').notNull(),
  referenceId:  text('reference_id'),
  staffId:      text('staff_id').notNull(),
  note:         text('note'),
  createdAt:    integer('created_at').default(sql`(unixepoch('now') * 1000)`).notNull(),
})


// ─── Suppliers ────────────────────────────────────────────────

export const suppliers = sqliteTable('suppliers', {
  id:            text('id').primaryKey().default(sql),
  branchId:      text('branch_id').notNull(),
  name:          text('name').notNull(),
  contactPerson: text('contact_person'),
  phone:         text('phone'),
  email:         text('email'),
  address:       text('address'),
  taxNumber:     text('tax_number'),
  isActive:      integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  ...syncCols,
})

// ─── GRN (Goods Received Note) ────────────────────────────────────

export const grn = sqliteTable('grn', {
  id:            text('id').primaryKey().default(sql),
  branchId:      text('branch_id').notNull(),
  supplierId:    text('supplier_id'),
  invoiceNumber: text('invoice_number'),
  receivedAt:    integer('received_at').notNull(),
  totalCost:     real('total_cost').default(0).notNull(),
  status:        text('status').default('received').notNull(),
  note:          text('note'),
  staffId:       text('staff_id').notNull(),
  ...syncCols,
})

export const grnItems = sqliteTable('grn_items', {
  id:          text('id').primaryKey().default(sql),
  grnId:       text('grn_id').notNull(),
  branchId:    text('branch_id').notNull(),
  productId:   text('product_id').notNull(),
  qtyOrdered:  real('qty_ordered').default(0).notNull(),
  qtyReceived: real('qty_received').notNull(),
  unitCost:    real('unit_cost').notNull(),
  totalCost:   real('total_cost').notNull(),
  ...syncCols,
})

// ─── App Config (license, trial, setup) ──────────────────────────────────────

export const appConfig = sqliteTable('app_config', {
  key:   text('key').primaryKey(),
  value: text('value').notNull(),
})

// ─── Sync Queue ───────────────────────────────────────────────────────────────

export const syncQueue = sqliteTable('sync_queue', {
  id:          text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  entityType:  text('entity_type').notNull(),
  entityId:    text('entity_id').notNull(),
  operation:   text('operation').notNull(),
  payload:     text('payload').notNull(),
  deviceId:    text('device_id').notNull(),
  branchId:    text('branch_id').notNull(),
  createdAt:   integer('created_at').notNull(),
  syncedAt:    integer('synced_at'),
  status:      text('status').default('pending').notNull(),
})
