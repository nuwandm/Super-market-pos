# Supermarket POS — Project Plan

> **Stack:** Exact match to `architecture.md`. No deviations.
> **Domain:** Sri Lankan small-to-medium supermarket — offline-first, touchscreen POS hardware.
> **Strategy:** Simple → Sellable → Scalable (Phase 1 to Phase 6).

---

## 1. Domain Research — Supermarket Business Logic

### What Makes a Supermarket POS Different from a Restaurant POS

| Concern | Restaurant | Supermarket |
|---|---|---|
| Item lookup | Menu browsing | Barcode scan + search |
| Item count | ~50–200 menu items | 500–10,000+ SKUs |
| Unit of measure | Portions/servings | kg, g, L, ml, piece, pack |
| Pricing | Fixed per item | Wholesale / retail / promotional tiers |
| Inventory | Kitchen stock | Shelf + storeroom stock |
| Suppliers | Few food vendors | 20–100+ FMCG suppliers |
| Returns | Rare | Common (expiry, damage) |
| Loyalty | Optional | Core feature (points, credit) |
| Promotions | Daily specials | Buy-X-get-Y, bundle, % off |
| Tax | Service charge + VAT | VAT / NBT per product category |
| Shift | Service sessions | Cashier shift + float management |

### Core Workflows in a Supermarket

```
1. RECEIVE STOCK    Supplier → Purchase Order → GRN → Inventory
2. SELL GOODS       Barcode Scan → Cart → Payment → Receipt → Stock Deduction
3. RETURN GOODS     Customer Return → Restock or Wastage → Refund
4. MANAGE STOCK     Stock Count → Adjustments → Reorder Alerts
5. CLOSE DAY        Z-Report → Cash Reconciliation → Day-End Summary
```

---

## 2. Monorepo Structure

```
suprer-market-pos/
├── apps/
│   ├── desktop/              ← Phase 1–3 (Electron offline POS)
│   ├── cloud-api/            ← Phase 4+ (Express + MongoDB)
│   ├── ordering-pwa/         ← Phase 4+ (Online ordering for customers)
│   └── driver-pwa/           ← Phase 5+ (Delivery tracking)
├── packages/
│   └── shared-types/         ← TypeScript interfaces shared across apps
├── package.json              ← npm workspaces root
├── plan.md                   ← This file
└── architecture.md           ← Tech standard reference
```

---

## 3. Desktop App Folder Structure

```
apps/desktop/
├── electron.vite.config.ts
├── drizzle.config.ts
├── src/
│   ├── main/
│   │   ├── index.ts                    ← App entry: window + IPC registration
│   │   ├── db/
│   │   │   ├── index.ts                ← initDb(), getDb(), closeDb()
│   │   │   ├── schema.ts               ← ALL Drizzle table definitions
│   │   │   ├── seed.ts                 ← Default admin, sample categories/products
│   │   │   └── migrations/
│   │   │       ├── 0000_initial.sql
│   │   │       └── meta/_journal.json
│   │   └── ipc/
│   │       ├── index.ts                ← registerAllIPC()
│   │       ├── auth.ipc.ts
│   │       ├── products.ipc.ts
│   │       ├── categories.ipc.ts
│   │       ├── inventory.ipc.ts
│   │       ├── sales.ipc.ts
│   │       ├── customers.ipc.ts
│   │       ├── suppliers.ipc.ts
│   │       ├── purchases.ipc.ts
│   │       ├── returns.ipc.ts
│   │       ├── promotions.ipc.ts
│   │       ├── reports.ipc.ts
│   │       └── settings.ipc.ts
│   ├── preload/
│   │   └── index.ts                    ← contextBridge → window.api
│   └── renderer/
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── components/
│           │   ├── ui/                 ← shadcn/ui components
│           │   └── layout/
│           │       ├── AppShell.tsx
│           │       ├── Sidebar.tsx
│           │       └── KeyboardShortcutsProvider.tsx
│           ├── pages/
│           │   ├── auth/               LoginPage.tsx
│           │   ├── dashboard/          DashboardPage.tsx
│           │   ├── pos/                POSPage.tsx
│           │   ├── products/           ProductsPage.tsx
│           │   ├── categories/         CategoriesPage.tsx
│           │   ├── inventory/          InventoryPage.tsx
│           │   ├── sales/              SalesHistoryPage.tsx
│           │   ├── customers/          CustomersPage.tsx
│           │   ├── suppliers/          SuppliersPage.tsx
│           │   ├── purchases/          PurchasesPage.tsx
│           │   ├── returns/            ReturnsPage.tsx
│           │   ├── reports/            ReportsPage.tsx
│           │   └── settings/           SettingsPage.tsx
│           ├── stores/
│           │   ├── auth.store.ts
│           │   └── cart.store.ts
│           ├── hooks/
│           │   └── useShortcut.ts
│           └── lib/
│               ├── api.ts
│               ├── utils.ts
│               └── receipt-i18n.ts
```

---

## 4. SQLite Database Schema

### Owner & Branch

```typescript
// supermarkets — owner entity
export const supermarkets = sqliteTable('supermarkets', {
  id:               text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  name:             text('name').notNull(),
  phone:            text('phone'),
  email:            text('email'),
  address:          text('address'),
  currency:         text('currency').default('LKR').notNull(),
  timezone:         text('timezone').default('Asia/Colombo').notNull(),
  taxRate:          real('tax_rate').default(0).notNull(),           // e.g. 18 for 18%
  vatNumber:        text('vat_number'),
  receiptHeader:    text('receipt_header'),
  receiptFooter:    text('receipt_footer'),
  receiptLanguage:  text('receipt_language').default('en').notNull(),
  ...syncCols,
})

// branches — per-location entity
export const branches = sqliteTable('branches', {
  id:               text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  supermarketId:    text('supermarket_id').notNull(),
  name:             text('name').notNull(),
  phone:            text('phone'),
  address:          text('address'),
  taxRate:          real('tax_rate'),                                // null = use supermarket default
  receiptHeader:    text('receipt_header'),
  receiptFooter:    text('receipt_footer'),
  isActive:         integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  ...syncCols,
})
```

### Staff & Auth

```typescript
// staff
export const staff = sqliteTable('staff', {
  id:           text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:     text('branch_id').notNull(),
  name:         text('name').notNull(),
  staffCode:    text('staff_code').notNull().unique(),   // e.g. "C001"
  role:         text('role').notNull(),                  // super_admin | manager | cashier | stock_keeper | viewer
  pinHash:      text('pin_hash').notNull(),
  pinSalt:      text('pin_salt').notNull(),
  isActive:     integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  ...syncCols,
})
```

**Roles for supermarket:**
| Role | Capabilities |
|---|---|
| `super_admin` | Everything — all branches, settings, reports |
| `manager` | Branch ops — products, staff, reports, discounts, approvals |
| `cashier` | POS sales, returns, customer lookup |
| `stock_keeper` | Inventory, GRN, purchase orders, adjustments |
| `viewer` | Read-only — dashboard, reports |

### Products & Categories

```typescript
// categories — hierarchical (parent → child)
export const categories = sqliteTable('categories', {
  id:           text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:     text('branch_id').notNull(),
  name:         text('name').notNull(),
  parentId:     text('parent_id'),                      // null = top-level
  sortOrder:    integer('sort_order').default(0).notNull(),
  isActive:     integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  ...syncCols,
})

// units — units of measure
export const units = sqliteTable('units', {
  id:           text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:     text('branch_id').notNull(),
  name:         text('name').notNull(),                  // e.g. "Kilogram"
  abbreviation: text('abbreviation').notNull(),          // e.g. "kg"
  isDecimal:    integer('is_decimal', { mode: 'boolean' }).default(false).notNull(), // allow fractional qty?
  ...syncCols,
})

// products — the master SKU list
export const products = sqliteTable('products', {
  id:              text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:        text('branch_id').notNull(),
  categoryId:      text('category_id').notNull(),
  unitId:          text('unit_id').notNull(),
  name:            text('name').notNull(),
  nameSinhala:     text('name_sinhala'),
  nameTamil:       text('name_tamil'),
  sku:             text('sku').notNull(),                // internal code
  barcode:         text('barcode'),                     // primary barcode (EAN-13 / QR)
  costPrice:       real('cost_price').default(0).notNull(),
  sellingPrice:    real('selling_price').notNull(),
  wholesalePrice:  real('wholesale_price'),
  taxRate:         real('tax_rate'),                    // null = use branch/supermarket default
  taxType:         text('tax_type').default('vat'),     // 'vat' | 'exempt'
  reorderLevel:    real('reorder_level').default(0).notNull(),
  reorderQty:      real('reorder_qty').default(0).notNull(),
  hasExpiry:       integer('has_expiry', { mode: 'boolean' }).default(false).notNull(),
  isActive:        integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  imageUrl:        text('image_url'),
  description:     text('description'),
  ...syncCols,
})

// product_barcodes — multiple barcodes per SKU (supplier variants, pack sizes)
export const productBarcodes = sqliteTable('product_barcodes', {
  id:          text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  productId:   text('product_id').notNull(),
  branchId:    text('branch_id').notNull(),
  barcode:     text('barcode').notNull(),
  packQty:     real('pack_qty').default(1).notNull(),   // how many base units this barcode represents
  ...syncCols,
})
```

### Inventory

```typescript
// inventory — current stock level per product per branch
export const inventory = sqliteTable('inventory', {
  id:           text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:     text('branch_id').notNull(),
  productId:    text('product_id').notNull(),
  qtyOnHand:    real('qty_on_hand').default(0).notNull(),
  qtyReserved:  real('qty_reserved').default(0).notNull(),   // reserved for pending orders
  lastCountedAt: integer('last_counted_at'),
  ...syncCols,
})

// stock_movements — every stock in/out event (event sourcing)
export const stockMovements = sqliteTable('stock_movements', {
  id:           text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:     text('branch_id').notNull(),
  productId:    text('product_id').notNull(),
  type:         text('type').notNull(),
  // 'grn_in' | 'sale_out' | 'return_in' | 'adjustment_in' | 'adjustment_out'
  // 'wastage_out' | 'transfer_in' | 'transfer_out' | 'opening_stock'
  referenceId:  text('reference_id'),                        // sale ID, GRN ID, etc.
  referenceType: text('reference_type'),                     // 'sale' | 'grn' | 'return' | 'adjustment'
  qtyBefore:    real('qty_before').notNull(),
  qtyChange:    real('qty_change').notNull(),                // positive = in, negative = out
  qtyAfter:     real('qty_after').notNull(),
  unitCost:     real('unit_cost'),
  staffId:      text('staff_id').notNull(),
  note:         text('note'),
  batchNumber:  text('batch_number'),
  expiryDate:   integer('expiry_date'),                      // Unix ms
  ...syncCols,
})
```

### Sales & Payments

```typescript
// sales — POS transaction header
export const sales = sqliteTable('sales', {
  id:              text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:        text('branch_id').notNull(),
  receiptNumber:   text('receipt_number').notNull(),         // e.g. "B01-2024-00047"
  staffId:         text('staff_id').notNull(),
  customerId:      text('customer_id'),
  subtotal:        real('subtotal').notNull(),
  discountAmount:  real('discount_amount').default(0).notNull(),
  discountType:    text('discount_type'),                    // 'percent' | 'fixed' | null
  taxAmount:       real('tax_amount').default(0).notNull(),
  total:           real('total').notNull(),
  status:          text('status').default('completed').notNull(),
  // 'completed' | 'voided' | 'on_hold' | 'parked'
  note:            text('note'),
  ...syncCols,
})

// sale_items — line items (IMMUTABLE once saved)
export const saleItems = sqliteTable('sale_items', {
  id:            text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  saleId:        text('sale_id').notNull(),
  branchId:      text('branch_id').notNull(),
  productId:     text('product_id').notNull(),
  productName:   text('product_name').notNull(),             // snapshot at time of sale
  barcode:       text('barcode'),
  qty:           real('qty').notNull(),
  unitPrice:     real('unit_price').notNull(),               // price at time of sale
  costPrice:     real('cost_price').notNull(),               // cost at time of sale (for profit calc)
  discountAmount: real('discount_amount').default(0).notNull(),
  taxAmount:     real('tax_amount').default(0).notNull(),
  total:         real('total').notNull(),
  ...syncCols,
})

// sale_payments — split payments (cash + card + loyalty points)
export const salePayments = sqliteTable('sale_payments', {
  id:            text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  saleId:        text('sale_id').notNull(),
  branchId:      text('branch_id').notNull(),
  method:        text('method').notNull(),
  // 'cash' | 'card' | 'mobile_pay' | 'loyalty_points' | 'credit' | 'qr'
  amount:        real('amount').notNull(),
  reference:     text('reference'),                          // card auth code, mobile ref, etc.
  ...syncCols,
})

// cash_sessions — cashier shift float management
export const cashSessions = sqliteTable('cash_sessions', {
  id:              text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:        text('branch_id').notNull(),
  staffId:         text('staff_id').notNull(),
  openedAt:        integer('opened_at').notNull(),
  closedAt:        integer('closed_at'),
  openingFloat:    real('opening_float').notNull(),
  closingCash:     real('closing_cash'),                     // counted cash at close
  expectedCash:    real('expected_cash'),                    // system calculated
  cashVariance:    real('cash_variance'),                    // difference
  status:          text('status').default('open').notNull(), // 'open' | 'closed'
  note:            text('note'),
  ...syncCols,
})
```

### Returns & Refunds

```typescript
// returns — customer return transaction header
export const returns = sqliteTable('returns', {
  id:              text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:        text('branch_id').notNull(),
  returnNumber:    text('return_number').notNull(),
  originalSaleId:  text('original_sale_id'),                // null = walk-in return without receipt
  staffId:         text('staff_id').notNull(),
  customerId:      text('customer_id'),
  refundAmount:    real('refund_amount').notNull(),
  refundMethod:    text('refund_method').notNull(),          // 'cash' | 'store_credit' | 'card'
  reason:          text('reason'),
  status:          text('status').default('completed').notNull(),
  ...syncCols,
})

// return_items
export const returnItems = sqliteTable('return_items', {
  id:            text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  returnId:      text('return_id').notNull(),
  branchId:      text('branch_id').notNull(),
  productId:     text('product_id').notNull(),
  productName:   text('product_name').notNull(),
  qty:           real('qty').notNull(),
  unitPrice:     real('unit_price').notNull(),
  total:         real('total').notNull(),
  restockAction: text('restock_action').notNull(),           // 'restock' | 'wastage'
  ...syncCols,
})
```

### Customers & Loyalty

```typescript
// customers
export const customers = sqliteTable('customers', {
  id:              text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:        text('branch_id').notNull(),
  name:            text('name').notNull(),
  phone:           text('phone').notNull(),                  // unique per branch
  email:           text('email'),
  address:         text('address'),
  loyaltyPoints:   real('loyalty_points').default(0).notNull(),
  creditBalance:   real('credit_balance').default(0).notNull(),  // store credit
  totalPurchases:  real('total_purchases').default(0).notNull(),
  isActive:        integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  ...syncCols,
})

// loyalty_transactions — every point earn/redeem event
export const loyaltyTransactions = sqliteTable('loyalty_transactions', {
  id:          text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:    text('branch_id').notNull(),
  customerId:  text('customer_id').notNull(),
  type:        text('type').notNull(),                       // 'earn' | 'redeem' | 'expire' | 'adjust'
  points:      real('points').notNull(),
  referenceId: text('reference_id'),
  note:        text('note'),
  ...syncCols,
})
```

### Suppliers & Purchases

```typescript
// suppliers
export const suppliers = sqliteTable('suppliers', {
  id:           text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:     text('branch_id').notNull(),
  name:         text('name').notNull(),
  contactPerson: text('contact_person'),
  phone:        text('phone'),
  email:        text('email'),
  address:      text('address'),
  paymentTerms: integer('payment_terms').default(0),         // days
  isActive:     integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  ...syncCols,
})

// purchase_orders — PO raised to supplier
export const purchaseOrders = sqliteTable('purchase_orders', {
  id:            text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:      text('branch_id').notNull(),
  poNumber:      text('po_number').notNull(),
  supplierId:    text('supplier_id').notNull(),
  staffId:       text('staff_id').notNull(),
  expectedDate:  integer('expected_date'),
  subtotal:      real('subtotal').notNull(),
  taxAmount:     real('tax_amount').default(0).notNull(),
  total:         real('total').notNull(),
  status:        text('status').default('draft').notNull(),
  // 'draft' | 'sent' | 'partial' | 'received' | 'cancelled'
  note:          text('note'),
  ...syncCols,
})

// purchase_order_items
export const purchaseOrderItems = sqliteTable('purchase_order_items', {
  id:          text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  poId:        text('po_id').notNull(),
  branchId:    text('branch_id').notNull(),
  productId:   text('product_id').notNull(),
  qtyOrdered:  real('qty_ordered').notNull(),
  qtyReceived: real('qty_received').default(0).notNull(),
  unitCost:    real('unit_cost').notNull(),
  total:       real('total').notNull(),
  ...syncCols,
})

// goods_received_notes — GRN: actual goods that arrived
export const goodsReceivedNotes = sqliteTable('goods_received_notes', {
  id:           text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:     text('branch_id').notNull(),
  grnNumber:    text('grn_number').notNull(),
  poId:         text('po_id'),                              // null = direct receive without PO
  supplierId:   text('supplier_id').notNull(),
  staffId:      text('staff_id').notNull(),
  invoiceNumber: text('invoice_number'),
  receivedAt:   integer('received_at').notNull(),
  subtotal:     real('subtotal').notNull(),
  taxAmount:    real('tax_amount').default(0).notNull(),
  total:        real('total').notNull(),
  status:       text('status').default('completed').notNull(),
  note:         text('note'),
  ...syncCols,
})

// grn_items
export const grnItems = sqliteTable('grn_items', {
  id:           text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  grnId:        text('grn_id').notNull(),
  branchId:     text('branch_id').notNull(),
  productId:    text('product_id').notNull(),
  qtyReceived:  real('qty_received').notNull(),
  unitCost:     real('unit_cost').notNull(),
  total:        real('total').notNull(),
  batchNumber:  text('batch_number'),
  expiryDate:   integer('expiry_date'),                     // Unix ms
  ...syncCols,
})
```

### Promotions & Discounts

```typescript
// promotions — configurable discount rules
export const promotions = sqliteTable('promotions', {
  id:              text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:        text('branch_id').notNull(),
  name:            text('name').notNull(),
  type:            text('type').notNull(),
  // 'percent_off_item' | 'fixed_off_item' | 'percent_off_order'
  // 'buy_x_get_y' | 'bundle_price'
  value:           real('value').notNull(),                  // % or fixed amount
  minQty:          real('min_qty'),
  freeQty:         real('free_qty'),                        // for buy-X-get-Y
  productId:       text('product_id'),                      // null = applies to all
  categoryId:      text('category_id'),                     // null = all categories
  startsAt:        integer('starts_at').notNull(),
  endsAt:          integer('ends_at'),                      // null = no expiry
  isActive:        integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  ...syncCols,
})
```

### Sync Infrastructure

```typescript
// sync_queue — offline → cloud sync engine
export const syncQueue = sqliteTable('sync_queue', {
  id:           text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  entityType:   text('entity_type').notNull(),
  entityId:     text('entity_id').notNull(),
  operation:    text('operation').notNull(),                 // 'create' | 'update' | 'delete'
  payload:      text('payload').notNull(),                   // JSON
  deviceId:     text('device_id').notNull(),
  branchId:     text('branch_id').notNull(),
  createdAt:    integer('created_at').notNull(),
  syncedAt:     integer('synced_at'),
  status:       text('status').default('pending').notNull(), // 'pending' | 'done' | 'conflict' | 'failed'
})
```

---

## 5. IPC Domains & Channels

### Auth
```
auth:login              (staffCode, pin)          → Session | error
auth:logout             ()                        → void
auth:getSession         ()                        → Session | null
auth:getContext         ()                        → { supermarket, branch }
```

### Products
```
products:getAll         (branchId, filters?)      → Product[]
products:getById        (id)                      → Product
products:getByBarcode   (barcode, branchId)       → Product | null
products:create         (data)                    → { success, id }
products:update         (id, data)                → { success }
products:delete         (id)                      → { success }    ← soft delete
products:search         (query, branchId)         → Product[]
```

### Categories
```
categories:getAll       (branchId)                → Category[]
categories:create       (data)                    → { success, id }
categories:update       (id, data)                → { success }
categories:delete       (id)                      → { success }
```

### Inventory
```
inventory:getAll        (branchId)                → InventoryItem[]
inventory:getLowStock   (branchId)                → InventoryItem[]
inventory:adjust        (productId, qty, reason)  → { success }
inventory:getMovements  (productId, branchId)     → StockMovement[]
inventory:stockCount    (branchId, items[])       → { success }
```

### Sales
```
sales:create            (data)                    → { success, id, receiptNumber }
sales:void              (id, reason)              → { success }
sales:getById           (id)                      → Sale
sales:getByReceipt      (receiptNumber)           → Sale
sales:getHistory        (branchId, filters)       → Sale[]
sales:parkSale          (data)                    → { success, id }
sales:resumeSale        (id)                      → Sale
sales:getParked         (branchId)                → Sale[]
sales:openSession       (staffId, float)          → { success, sessionId }
sales:closeSession      (sessionId, closingCash)  → { success, report }
sales:getCurrentSession (staffId)                 → CashSession | null
```

### Customers
```
customers:getAll        (branchId)                → Customer[]
customers:search        (query, branchId)         → Customer[]
customers:getById       (id)                      → Customer
customers:getByPhone    (phone, branchId)         → Customer | null
customers:create        (data)                    → { success, id }
customers:update        (id, data)                → { success }
customers:getLoyalty    (id)                      → LoyaltyTransaction[]
customers:addPoints     (customerId, points, ref) → { success }
customers:redeemPoints  (customerId, points, ref) → { success }
```

### Suppliers
```
suppliers:getAll        (branchId)                → Supplier[]
suppliers:create        (data)                    → { success, id }
suppliers:update        (id, data)                → { success }
suppliers:delete        (id)                      → { success }
```

### Purchases
```
purchases:createPO      (data)                    → { success, id, poNumber }
purchases:getPOs        (branchId, filters)       → PurchaseOrder[]
purchases:getPOById     (id)                      → PurchaseOrder
purchases:createGRN     (data)                    → { success, id, grnNumber }
purchases:getGRNs       (branchId, filters)       → GoodsReceivedNote[]
purchases:getGRNById    (id)                      → GoodsReceivedNote
```

### Returns
```
returns:create          (data)                    → { success, id, returnNumber }
returns:getById         (id)                      → Return
returns:getHistory      (branchId, filters)       → Return[]
```

### Promotions
```
promotions:getActive    (branchId)                → Promotion[]
promotions:getAll       (branchId)                → Promotion[]
promotions:create       (data)                    → { success, id }
promotions:update       (id, data)                → { success }
promotions:delete       (id)                      → { success }
promotions:evaluate     (branchId, cartItems)     → AppliedPromotion[]
```

### Reports
```
reports:dailySales      (branchId, date)          → DailySalesReport
reports:salesSummary    (branchId, from, to)      → SalesSummaryReport
reports:topProducts     (branchId, from, to, n)   → ProductSalesReport[]
reports:categoryWise    (branchId, from, to)      → CategorySalesReport[]
reports:inventoryValue  (branchId)                → InventoryValueReport
reports:lowStock        (branchId)                → LowStockReport[]
reports:expiryAlerts    (branchId, days)          → ExpiryAlertReport[]
reports:profitLoss      (branchId, from, to)      → ProfitLossReport
reports:staffSales      (branchId, from, to)      → StaffSalesReport[]
reports:cashierShifts   (branchId, from, to)      → CashSessionReport[]
reports:customerPurchases(customerId)             → CustomerPurchaseReport
```

### Settings
```
settings:getSupermarket ()                        → Supermarket
settings:updateSupermarket (id, data)             → { success }
settings:getBranch      ()                        → Branch
settings:updateBranch   (id, data)                → { success }
settings:getUnits       (branchId)                → Unit[]
settings:createUnit     (data)                    → { success, id }
settings:updateUnit     (id, data)                → { success }
```

---

## 6. UI Pages — Detailed

### `/login` — PIN Login Page
- Staff code input → PIN pad (6 keys: 0–9, delete, confirm)
- "Welcome back, [Name]" greeting
- Error: wrong PIN, inactive account
- Language: English UI only (configurable in Settings)

### `/dashboard` — Overview
- Today's sales total (JetBrains Mono display font)
- Today's transaction count
- Current cashier session float status
- Top 5 selling products today
- Low stock alert count (clickable → inventory page)
- Expiry alerts count (clickable → inventory page)

### `/pos` — Main POS Screen ★ CORE PAGE

**Layout: Split panel**

```
┌─────────────────────────────┬──────────────────────────────┐
│  LEFT: Product Search Panel │  RIGHT: Cart Panel           │
│                             │                              │
│  [🔍 Search / Scan Barcode] │  Customer: [Search or None]  │
│                             │  ─────────────────────────── │
│  Category Tabs:             │  Item          Qty  Price    │
│  [All] [Dairy] [Bev] [...]  │  Milk 1L        2   240.00  │
│                             │  Sugar 1kg      1   180.00  │
│  ┌──────┐ ┌──────┐          │  ─────────────────────────── │
│  │ Milk │ │Sugar │          │  Subtotal:        420.00    │
│  │1L    │ │1kg   │          │  Discount:          0.00    │
│  │240   │ │180   │          │  Tax (0%):           0.00   │
│  └──────┘ └──────┘          │  TOTAL:           420.00    │
│                             │                              │
│  [Noodles][Bread][Eggs]...  │  [🅟 Park] [💳 Checkout →]  │
└─────────────────────────────┴──────────────────────────────┘
```

**Key interactions:**
- Barcode scan → instant item add to cart (USB HID scanner = keyboard input)
- Manual search → fuzzy match on name, SKU, barcode
- Category filter tabs
- Click item card → add to cart
- Cart item row: qty stepper (+ / −), long-press → delete
- Discount: cashier = fixed amount only; manager = % or override
- Park sale → save for later, start new transaction
- Checkout → payment dialog

**Payment Dialog:**
```
Total Due: LKR 420.00
─────────────────────────
[💵 Cash]  [💳 Card]  [📱 Mobile]  [⭐ Points]
─────────────────────────
Cash Tendered:  [    600.00  ]
Change Due:      LKR 180.00
─────────────────────────
           [✓ Confirm & Print]
```

- Split payment: allow multiple methods
- Loyalty points redemption: 1 point = LKR 1 (configurable)
- Print receipt (thermal) OR skip

### `/products` — Product Management
- Table view: name, SKU, barcode, category, unit, selling price, stock, status
- Filters: category, active/inactive, low stock
- Quick search
- Add/Edit dialog: all product fields, barcode scanner integration
- Import from CSV (Phase 2)
- Price history modal (audit trail)

### `/categories` — Category Management
- Tree view: parent → children
- Drag to reorder
- Add/Edit/Delete (soft delete)

### `/inventory` — Stock Management

**3 sub-tabs:**
1. **Current Stock** — table: product, on-hand qty, reorder level, status badge
   - Filter: all | low stock | out of stock | expiring soon
   - Quick adjust (+ / −) with reason
   - Full stock count (enter counted qty for all items)
2. **Stock Movements** — audit log: date, product, type, qty change, staff
3. **Expiry Alerts** — products expiring within 30/60/90 days

### `/purchases` — Supplier Procurement

**2 sub-tabs:**
1. **Purchase Orders** — create PO → select supplier → add items → send
   - Status: Draft → Sent → Partial → Received → Cancelled
2. **Goods Received (GRN)** — receive goods against PO or directly
   - Updates inventory automatically on save
   - Batch/expiry tracking per line

### `/sales` — Sales History
- Date filter, cashier filter, receipt search
- Click row → view full receipt details
- Void sale (manager PIN required)
- Reprint receipt

### `/returns` — Customer Returns
- Search original sale by receipt number or customer
- Select items to return (partial return allowed)
- Choose restock action per item (restock / wastage)
- Choose refund method (cash / store credit / card)
- Print return receipt

### `/customers` — Customer Database
- Table: name, phone, loyalty points, total purchases
- Click → detail view: purchase history, loyalty transactions
- Add/Edit customer
- Top customers by spend (Phase 2 report)

### `/reports` — Reports Suite (Phase 2)

**Report tabs:**
1. Daily Sales Summary (Z-Report) — end of day
2. Sales by Date Range
3. Product-wise Sales
4. Category-wise Sales
5. Inventory Value
6. Low Stock Report
7. Profit & Loss
8. Staff Performance
9. Customer Loyalty Report
10. Cashier Shift Report

All reports: on-screen display + Print / Export PDF / Export Excel

### `/settings` — Settings (always tab-based)

| Tab | Icon | Content |
|---|---|---|
| Supermarket | Building2 | Name, address, VAT, currency, timezone, tax rate, default footer |
| Branch | MapPin | Location info, local tax override, receipt header/footer |
| Receipt & Printing | Receipt | Language selector (EN / සිංහල / தமிழ்), thermal printer config |
| Users & Roles | Shield | Staff management, role assignment, PIN reset (Phase 2) |
| Units | Ruler | Unit of measure management (kg, g, L, piece, etc.) |
| Backup | HardDrive | Manual export / restore, auto-backup schedule (Phase 3) |
| License | Key | Activation status, device ID, enter key (Phase 3) |

---

## 7. Shared Types (`packages/shared-types`)

```typescript
// packages/shared-types/src/index.ts

export interface Supermarket {
  id: string; name: string; phone?: string; email?: string;
  address?: string; currency: string; timezone: string;
  taxRate: number; vatNumber?: string;
  receiptHeader?: string; receiptFooter?: string; receiptLanguage: string;
}

export interface Branch {
  id: string; supermarketId: string; name: string;
  phone?: string; address?: string;
  taxRate?: number; receiptHeader?: string; receiptFooter?: string;
  isActive: boolean;
}

export interface Staff {
  id: string; branchId: string; name: string;
  staffCode: string; role: StaffRole; isActive: boolean;
}

export type StaffRole = 'super_admin' | 'manager' | 'cashier' | 'stock_keeper' | 'viewer'

export interface Session {
  staffId: string; staffName: string; staffCode: string; role: StaffRole;
  branchId: string; loggedInAt: number;
}

export interface Product {
  id: string; branchId: string; categoryId: string; unitId: string;
  name: string; nameSinhala?: string; nameTamil?: string;
  sku: string; barcode?: string;
  costPrice: number; sellingPrice: number; wholesalePrice?: number;
  taxRate?: number; taxType: 'vat' | 'exempt';
  reorderLevel: number; reorderQty: number;
  hasExpiry: boolean; isActive: boolean;
  qtyOnHand?: number;   // joined from inventory
  category?: Category;  // joined
  unit?: Unit;          // joined
}

export interface Category {
  id: string; branchId: string; name: string;
  parentId?: string; sortOrder: number; isActive: boolean;
}

export interface Unit {
  id: string; branchId: string; name: string;
  abbreviation: string; isDecimal: boolean;
}

export interface CartItem {
  productId: string; name: string; sku: string; barcode?: string;
  qty: number; unitPrice: number; costPrice: number;
  discountAmount: number; taxAmount: number; total: number;
  unitAbbr: string;
}

export interface Sale {
  id: string; branchId: string; receiptNumber: string;
  staffId: string; customerId?: string;
  subtotal: number; discountAmount: number; discountType?: string;
  taxAmount: number; total: number; status: SaleStatus;
  items: SaleItem[]; payments: SalePayment[];
  createdAt: number;
}

export type SaleStatus = 'completed' | 'voided' | 'on_hold' | 'parked'

export interface SaleItem {
  id: string; saleId: string; productId: string;
  productName: string; barcode?: string;
  qty: number; unitPrice: number; costPrice: number;
  discountAmount: number; taxAmount: number; total: number;
}

export interface SalePayment {
  id: string; saleId: string; method: PaymentMethod;
  amount: number; reference?: string;
}

export type PaymentMethod = 'cash' | 'card' | 'mobile_pay' | 'loyalty_points' | 'credit' | 'qr'

export interface Customer {
  id: string; branchId: string; name: string; phone: string;
  email?: string; address?: string;
  loyaltyPoints: number; creditBalance: number; totalPurchases: number;
  isActive: boolean;
}

export interface Supplier {
  id: string; branchId: string; name: string;
  contactPerson?: string; phone?: string; email?: string;
  address?: string; paymentTerms: number; isActive: boolean;
}

export interface PurchaseOrder {
  id: string; branchId: string; poNumber: string; supplierId: string;
  staffId: string; expectedDate?: number;
  subtotal: number; taxAmount: number; total: number;
  status: POStatus; note?: string;
  items: PurchaseOrderItem[];
}

export type POStatus = 'draft' | 'sent' | 'partial' | 'received' | 'cancelled'

export interface GoodsReceivedNote {
  id: string; branchId: string; grnNumber: string;
  poId?: string; supplierId: string; staffId: string;
  invoiceNumber?: string; receivedAt: number;
  subtotal: number; taxAmount: number; total: number;
  status: string; note?: string; items: GRNItem[];
}

export interface CashSession {
  id: string; branchId: string; staffId: string;
  openedAt: number; closedAt?: number;
  openingFloat: number; closingCash?: number;
  expectedCash?: number; cashVariance?: number;
  status: 'open' | 'closed';
}
```

---

## 8. Preload API Shape

```typescript
// preload/index.ts — complete window.api shape
const api = {
  auth: {
    login:          (staffCode: string, pin: string) => invoke('auth:login', staffCode, pin),
    logout:         ()                               => invoke('auth:logout'),
    getSession:     ()                               => invoke('auth:getSession'),
    getContext:     ()                               => invoke('auth:getContext'),
  },
  products: {
    getAll:         (branchId: string, filters?: unknown) => invoke('products:getAll', branchId, filters),
    getById:        (id: string)                          => invoke('products:getById', id),
    getByBarcode:   (barcode: string, branchId: string)   => invoke('products:getByBarcode', barcode, branchId),
    create:         (data: Record<string, unknown>)       => invoke('products:create', data),
    update:         (id: string, data: Record<string, unknown>) => invoke('products:update', id, data),
    delete:         (id: string)                          => invoke('products:delete', id),
    search:         (query: string, branchId: string)     => invoke('products:search', query, branchId),
  },
  categories: {
    getAll:         (branchId: string)                    => invoke('categories:getAll', branchId),
    create:         (data: Record<string, unknown>)       => invoke('categories:create', data),
    update:         (id: string, data: Record<string, unknown>) => invoke('categories:update', id, data),
    delete:         (id: string)                          => invoke('categories:delete', id),
  },
  inventory: {
    getAll:         (branchId: string)                    => invoke('inventory:getAll', branchId),
    getLowStock:    (branchId: string)                    => invoke('inventory:getLowStock', branchId),
    adjust:         (productId: string, qty: number, type: string, reason: string) =>
                    invoke('inventory:adjust', productId, qty, type, reason),
    getMovements:   (productId: string, branchId: string) => invoke('inventory:getMovements', productId, branchId),
    stockCount:     (branchId: string, items: unknown[])  => invoke('inventory:stockCount', branchId, items),
  },
  sales: {
    create:         (data: Record<string, unknown>)       => invoke('sales:create', data),
    void:           (id: string, reason: string)          => invoke('sales:void', id, reason),
    getById:        (id: string)                          => invoke('sales:getById', id),
    getByReceipt:   (receiptNumber: string)               => invoke('sales:getByReceipt', receiptNumber),
    getHistory:     (branchId: string, filters: unknown)  => invoke('sales:getHistory', branchId, filters),
    parkSale:       (data: Record<string, unknown>)       => invoke('sales:parkSale', data),
    resumeSale:     (id: string)                          => invoke('sales:resumeSale', id),
    getParked:      (branchId: string)                    => invoke('sales:getParked', branchId),
    openSession:    (staffId: string, float: number)      => invoke('sales:openSession', staffId, float),
    closeSession:   (sessionId: string, closingCash: number) => invoke('sales:closeSession', sessionId, closingCash),
    getCurrentSession: (staffId: string)                  => invoke('sales:getCurrentSession', staffId),
  },
  customers: {
    getAll:         (branchId: string)                    => invoke('customers:getAll', branchId),
    search:         (query: string, branchId: string)     => invoke('customers:search', query, branchId),
    getById:        (id: string)                          => invoke('customers:getById', id),
    getByPhone:     (phone: string, branchId: string)     => invoke('customers:getByPhone', phone, branchId),
    create:         (data: Record<string, unknown>)       => invoke('customers:create', data),
    update:         (id: string, data: Record<string, unknown>) => invoke('customers:update', id, data),
    getLoyalty:     (id: string)                          => invoke('customers:getLoyalty', id),
    addPoints:      (customerId: string, points: number, ref: string) =>
                    invoke('customers:addPoints', customerId, points, ref),
    redeemPoints:   (customerId: string, points: number, ref: string) =>
                    invoke('customers:redeemPoints', customerId, points, ref),
  },
  suppliers: {
    getAll:         (branchId: string)                    => invoke('suppliers:getAll', branchId),
    create:         (data: Record<string, unknown>)       => invoke('suppliers:create', data),
    update:         (id: string, data: Record<string, unknown>) => invoke('suppliers:update', id, data),
    delete:         (id: string)                          => invoke('suppliers:delete', id),
  },
  purchases: {
    createPO:       (data: Record<string, unknown>)       => invoke('purchases:createPO', data),
    getPOs:         (branchId: string, filters: unknown)  => invoke('purchases:getPOs', branchId, filters),
    getPOById:      (id: string)                          => invoke('purchases:getPOById', id),
    createGRN:      (data: Record<string, unknown>)       => invoke('purchases:createGRN', data),
    getGRNs:        (branchId: string, filters: unknown)  => invoke('purchases:getGRNs', branchId, filters),
    getGRNById:     (id: string)                          => invoke('purchases:getGRNById', id),
  },
  returns: {
    create:         (data: Record<string, unknown>)       => invoke('returns:create', data),
    getById:        (id: string)                          => invoke('returns:getById', id),
    getHistory:     (branchId: string, filters: unknown)  => invoke('returns:getHistory', branchId, filters),
  },
  promotions: {
    getActive:      (branchId: string)                    => invoke('promotions:getActive', branchId),
    getAll:         (branchId: string)                    => invoke('promotions:getAll', branchId),
    create:         (data: Record<string, unknown>)       => invoke('promotions:create', data),
    update:         (id: string, data: Record<string, unknown>) => invoke('promotions:update', id, data),
    delete:         (id: string)                          => invoke('promotions:delete', id),
    evaluate:       (branchId: string, items: unknown[])  => invoke('promotions:evaluate', branchId, items),
  },
  reports: {
    dailySales:         (branchId: string, date: number)          => invoke('reports:dailySales', branchId, date),
    salesSummary:       (branchId: string, from: number, to: number) => invoke('reports:salesSummary', branchId, from, to),
    topProducts:        (branchId: string, from: number, to: number, n: number) => invoke('reports:topProducts', branchId, from, to, n),
    categoryWise:       (branchId: string, from: number, to: number) => invoke('reports:categoryWise', branchId, from, to),
    inventoryValue:     (branchId: string)                        => invoke('reports:inventoryValue', branchId),
    lowStock:           (branchId: string)                        => invoke('reports:lowStock', branchId),
    expiryAlerts:       (branchId: string, days: number)          => invoke('reports:expiryAlerts', branchId, days),
    profitLoss:         (branchId: string, from: number, to: number) => invoke('reports:profitLoss', branchId, from, to),
    staffSales:         (branchId: string, from: number, to: number) => invoke('reports:staffSales', branchId, from, to),
    cashierShifts:      (branchId: string, from: number, to: number) => invoke('reports:cashierShifts', branchId, from, to),
  },
  settings: {
    getSupermarket:     ()                               => invoke('settings:getSupermarket'),
    updateSupermarket:  (id: string, data: Record<string, unknown>) => invoke('settings:updateSupermarket', id, data),
    getBranch:          ()                               => invoke('settings:getBranch'),
    updateBranch:       (id: string, data: Record<string, unknown>) => invoke('settings:updateBranch', id, data),
    getUnits:           (branchId: string)               => invoke('settings:getUnits', branchId),
    createUnit:         (data: Record<string, unknown>)  => invoke('settings:createUnit', data),
    updateUnit:         (id: string, data: Record<string, unknown>) => invoke('settings:updateUnit', id, data),
  },
}
```

---

## 9. Keyboard Shortcuts (POS Page)

| Shortcut | Action |
|---|---|
| `F2` | Focus barcode/search input |
| `F4` | Open parked sales |
| `F5` | New sale (clear cart) |
| `F8` | Apply discount dialog |
| `F10` | Checkout / payment |
| `F12` | Void current item |
| `Esc` | Cancel / close dialog |
| `Enter` | Confirm |
| `NumPad+` | Increase qty of last item |
| `NumPad-` | Decrease qty of last item |

---

## 10. Receipt Labels — Supermarket i18n

```typescript
// lib/receipt-i18n.ts — supermarket additions
export interface DocLabels {
  receipt: string; invoice: string; returnReceipt: string;
  subtotal: string; discount: string; tax: string; total: string;
  cash: string; card: string; mobilePay: string; change: string;
  loyaltyPointsEarned: string; loyaltyPointsRedeemed: string;
  loyaltyBalance: string; vatNumber: string;
  items: string; qty: string; unitPrice: string; amount: string;
  cashier: string; thankYou: string; returnPolicy: string;
}

// en / si / ta translations for all above
```

---

## 11. Receipt Number Format

```
{branch-prefix}-{YYYY}{MM}{DD}-{5-digit-seq}

Examples:
  COL-20240615-00047    ← Colombo branch, 47th sale today
  KAN-20240615-00001    ← Kandy branch, 1st sale today
```

- Branch prefix configured in Settings → Branch
- Sequence resets to 00001 at midnight
- Stored in a `sequences` table (or derived from COUNT of today's sales)

---

## 12. Sidebar Navigation

```
─── POS ──────────────────────
  [ShoppingCart]  Point of Sale
─── OPERATIONS ───────────────
  [Package]       Products
  [Tag]           Categories
  [Boxes]         Inventory
  [Truck]         Purchases
  [RotateCcw]     Returns
  [Users]         Customers
─── REPORTS ──────────────────
  [BarChart2]     Reports
─── ADMIN ────────────────────
  [Settings]      Settings
```

Role visibility:
- Cashier: POS, Customers only
- Stock Keeper: POS, Inventory, Purchases, Returns
- Manager: All except Settings (License tab)
- Super Admin: Everything

---

## 13. Phase Plan — Supermarket

### Phase 1 — Offline MVP (Weeks 1–4)
**Target: First paying customer, fully operational offline POS**

- [ ] Monorepo scaffold (npm workspaces + shared-types)
- [ ] Electron + React + SQLite + Drizzle setup (architecture.md §19 checklist)
- [ ] Full schema.ts with all tables + 0000_initial.sql migration
- [ ] Seed: default supermarket, branch, super_admin staff, sample categories, units, products
- [ ] Auth: PIN login (staffCode → PIN pad), session guard in AppShell
- [ ] Product management: CRUD + barcode field
- [ ] Category management: CRUD with hierarchy
- [ ] Units management: CRUD
- [ ] Inventory: initial stock, basic adjust
- [ ] **POS page**: barcode scan + search, cart, cash payment, receipt print
- [ ] Sales: create, complete, view history
- [ ] Cash session: open/close with float
- [ ] Settings: Supermarket + Branch + Receipt & Printing tabs
- [ ] Windows installer (NSIS)

**Deliverable:** Cashier can open a shift, scan/search items, take cash payment, print receipt, close shift.

---

### Phase 2 — Business Features (Weeks 5–8)
**Target: Full back-office for manager**

- [ ] Multi-payment (card, mobile, split)
- [ ] Customer database + loyalty points earn/redeem
- [ ] Park & resume sales
- [ ] Supplier management
- [ ] Purchase orders (PO workflow)
- [ ] Goods received notes (GRN → auto stock update)
- [ ] Returns & refunds (with restock)
- [ ] Promotions engine (% off, fixed off, buy-X-get-Y)
- [ ] Full reports suite (daily Z-report, sales by range, top products, category-wise)
- [ ] Inventory value report, low stock report, expiry alerts
- [ ] Profit & Loss report (cost price captured at sale time)
- [ ] Staff performance report
- [ ] PDF export for all reports
- [ ] CSV export
- [ ] Settings → Users & Roles tab (PIN management)
- [ ] Multi-barcode per product

---

### Phase 3 — Hardware & UX Polish (Weeks 9–12)
**Target: Complete hardware integration + license protection**

- [ ] Thermal receipt printer (ESC/POS via USB / network)
- [ ] Cash drawer trigger (via printer COM port)
- [ ] USB barcode scanner (already works as keyboard HID — but add scan mode UX)
- [ ] Customer/secondary display (second Electron window, shows cart + total)
- [ ] Barcode label printing (for price tags)
- [ ] Offline license key system (architecture.md §16)
- [ ] Auto-backup (daily + on day-close)
- [ ] Settings → Backup & License tabs
- [ ] System tray icon
- [ ] Auto-updater (electron-updater)
- [ ] Keyboard shortcut overlay (? key)

---

### Phase 4 — Cloud (Weeks 13–18)
**Target: Multi-device, owner dashboard**

- [ ] Cloud API: Express + MongoDB Atlas + Mongoose
- [ ] Owner account registration + JWT auth
- [ ] Sync engine (sync_queue → cloud, idempotent upsert)
- [ ] Owner web dashboard (real-time sales, inventory)
- [ ] Remote product/price management
- [ ] Cloud backup to Atlas
- [ ] Multi-device support (2+ POS terminals)

---

### Phase 5 — Online Ordering (Weeks 19–22)
- [ ] Customer-facing PWA (online ordering)
- [ ] Delivery tracking
- [ ] Payment gateway (PayHere / Stripe)
- [ ] Online order → POS notification

---

### Phase 6 — Ecosystem (Months 6–12)
- [ ] Multi-branch / franchise management
- [ ] Cross-branch consolidated reports
- [ ] AI: demand forecasting, reorder suggestions
- [ ] React Native owner app
- [ ] White-label branding
- [ ] 3rd-party delivery integrations

---

## 14. Seed Data

```typescript
// seed.ts — initial data on first run
const defaultSupermarket = {
  name: 'My Supermarket', currency: 'LKR',
  timezone: 'Asia/Colombo', taxRate: 0, receiptLanguage: 'en',
}

const defaultBranch = { name: 'Main Branch', isActive: true }

const defaultAdmin = {
  name: 'Admin', staffCode: 'ADM001', role: 'super_admin',
  pin: '1234',  // hashed with SHA-256 + salt before insert
}

const defaultUnits = [
  { name: 'Piece',     abbreviation: 'pcs', isDecimal: false },
  { name: 'Kilogram',  abbreviation: 'kg',  isDecimal: true  },
  { name: 'Gram',      abbreviation: 'g',   isDecimal: true  },
  { name: 'Litre',     abbreviation: 'L',   isDecimal: true  },
  { name: 'Millilitre',abbreviation: 'ml',  isDecimal: true  },
  { name: 'Pack',      abbreviation: 'pk',  isDecimal: false },
  { name: 'Box',       abbreviation: 'box', isDecimal: false },
  { name: 'Dozen',     abbreviation: 'dz',  isDecimal: false },
]

const defaultCategories = [
  'Dairy & Eggs', 'Beverages', 'Bakery & Bread',
  'Rice & Grains', 'Fruits & Vegetables', 'Meat & Seafood',
  'Snacks & Confectionery', 'Household & Cleaning',
  'Personal Care', 'Baby & Kids',
]
```

---

## 15. Key Business Rules

1. **Stock deduction happens on sale completion**, not at checkout initiation
2. **Negative stock is allowed** (configurable) — some shops sell before restocking
3. **Cost price is captured at sale time** — for profit reports even after price changes
4. **VAT-exempt products** (essential food items) must not have tax applied
5. **Loyalty: 1 LKR spent = 1 point earned** (configurable ratio in settings)
6. **Voiding a sale restores stock** — automatic reversal via stock movement
7. **GRN creates stock movement records** — inventory is always traceable
8. **Returns: restock creates +movement; wastage creates +movement tagged as wastage**
9. **Promotions evaluated in order** — highest discount wins if overlapping
10. **Parked sales expire after 24 hours** (configurable) — auto-void
11. **Cash session must be open** before a cashier can process sales
12. **Manager PIN required** for: voiding sales, applying % discount > 10%, reducing price
13. **Financial records are immutable** — void creates a reversal record, never edits

---

## 16. Bootstrap Command Sequence

```bash
# 1. Create monorepo
mkdir suprer-market-pos && cd suprer-market-pos
npm init -y

# 2. Setup workspaces in root package.json
# (add "workspaces": ["apps/*", "packages/*"])

# 3. Create shared-types package
mkdir -p packages/shared-types/src
cd packages/shared-types && npm init -y

# 4. Scaffold desktop app
cd apps
npm create electron-vite@latest desktop -- --template react-ts

# 5. Install all dependencies (from architecture.md §22)
cd apps/desktop
npm install @libsql/client drizzle-orm react-hook-form zod \
  @hookform/resolvers sonner lucide-react zustand \
  react-router-dom clsx tailwind-merge class-variance-authority \
  @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-label @radix-ui/react-select @radix-ui/react-separator \
  @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-tabs \
  @radix-ui/react-toast @radix-ui/react-tooltip \
  @fontsource-variable/plus-jakarta-sans \
  @fontsource/jetbrains-mono \
  @fontsource/noto-sans-sinhala \
  @fontsource/noto-sans-tamil \
  @pos/shared-types

npm install -D drizzle-kit tailwindcss postcss autoprefixer

# 6. Generate initial migration
npx drizzle-kit generate

# 7. Run dev
npm run dev
```

---

## 17. Color Assignments for Supermarket Status

Following architecture.md §10 entity status pattern:

| Status | Color | Hex | Use |
|---|---|---|---|
| In Stock | Available | `#22C55E` | Normal stock level |
| Low Stock | Attention | `#F97316` | Below reorder level |
| Out of Stock | In Use / Occupied | `#EF4444` | Zero on hand |
| Expiring Soon | Warning | `#D97706` | Within 30 days |
| Expired | Danger | `#DC2626` | Past expiry |
| Pending (PO) | Pending | `#EAB308` | PO sent, not received |
| Received (GRN) | Available | `#22C55E` | Stock received |
| Sale Completed | Success | `#16A34A` | Transaction done |
| Sale Voided | Danger | `#DC2626` | Reversed |
| Sale Parked | Info | `#2563EB` | On hold |

---

*Plan created following architecture.md conventions exactly.*
*Domain: Supermarket POS — Sri Lankan small/medium business.*
*Infrastructure never changes. Only domain content changes.*
