// ─── Auth ─────────────────────────────────────────────────────────────────────

export type StaffRole = 'super_admin' | 'manager' | 'cashier' | 'stock_keeper' | 'viewer'

export interface Session {
  staffId: string
  staffName: string
  staffCode: string
  role: StaffRole
  branchId: string
  loggedInAt: number
}

// ─── Owner Entities ───────────────────────────────────────────────────────────

export interface Supermarket {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  currency: string
  timezone: string
  taxRate: number
  vatNumber?: string | null
  receiptHeader?: string | null
  receiptFooter?: string | null
  receiptLanguage: string
  logoPath?: string | null
  createdAt: number
  updatedAt: number
}

export interface Branch {
  id: string
  supermarketId: string
  name: string
  branchCode: string
  phone?: string | null
  address?: string | null
  taxRate?: number | null
  receiptHeader?: string | null
  receiptFooter?: string | null
  isActive: boolean
  createdAt: number
  updatedAt: number
}

export interface Staff {
  id: string
  branchId: string
  name: string
  staffCode: string
  role: StaffRole
  isActive: boolean
  createdAt: number
  updatedAt: number
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export interface Category {
  id: string
  branchId: string
  name: string
  parentId?: string | null
  sortOrder: number
  isActive: boolean
  createdAt: number
  updatedAt: number
}

export interface Unit {
  id: string
  branchId: string
  name: string
  abbreviation: string
  isDecimal: boolean
  createdAt: number
  updatedAt: number
}

export interface Product {
  id: string
  branchId: string
  categoryId: string
  unitId: string
  name: string
  nameSinhala?: string | null
  nameTamil?: string | null
  sku: string
  barcode?: string | null
  costPrice: number
  sellingPrice: number
  wholesalePrice?: number | null
  taxRate?: number | null
  taxType: 'vat' | 'exempt'
  reorderLevel: number
  reorderQty: number
  hasExpiry: boolean
  expiryDate?: number | null
  isActive: boolean
  imageUrl?: string | null
  description?: string | null
  createdAt: number
  updatedAt: number
  // Joined fields (optional)
  qtyOnHand?: number
  unitAbbr?: string | null
  categoryName?: string | null
  category?: Category
  unit?: Unit
}

export interface ProductBarcode {
  id: string
  productId: string
  branchId: string
  barcode: string
  packQty: number
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface InventoryRecord {
  id: string
  branchId: string
  productId: string
  qtyOnHand: number
  qtyReserved: number
  lastCountedAt?: number | null
  updatedAt: number
  // Joined
  product?: Product
}

export interface StockMovement {
  id: string
  branchId: string
  productId: string
  type: StockMovementType
  referenceId?: string | null
  referenceType?: string | null
  qtyBefore: number
  qtyChange: number
  qtyAfter: number
  unitCost?: number | null
  staffId: string
  note?: string | null
  batchNumber?: string | null
  expiryDate?: number | null
  createdAt: number
}

export type StockMovementType =
  | 'grn_in'
  | 'sale_out'
  | 'return_in'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'wastage_out'
  | 'transfer_in'
  | 'transfer_out'
  | 'opening_stock'

// ─── Sales ────────────────────────────────────────────────────────────────────

export type SaleStatus = 'completed' | 'voided' | 'returned' | 'on_hold' | 'parked'

export type PaymentMethod = 'cash' | 'card' | 'mobile_pay' | 'loyalty_points' | 'credit' | 'qr'

export interface CartItem {
  productId: string
  name: string
  sku: string
  barcode?: string | null
  qty: number
  unitPrice: number
  costPrice: number
  discountAmount: number
  taxAmount: number
  total: number
  unitAbbr: string
}

export interface Sale {
  id: string
  branchId: string
  receiptNumber: string
  staffId: string
  customerId?: string | null
  subtotal: number
  discountAmount: number
  discountType?: string | null
  taxAmount: number
  total: number
  status: SaleStatus
  note?: string | null
  createdAt: number
  updatedAt: number
  items?: SaleItem[]
  payments?: SalePayment[]
}

export interface SaleItem {
  id: string
  saleId: string
  branchId: string
  productId: string
  productName: string
  barcode?: string | null
  qty: number
  unitPrice: number
  costPrice: number
  discountAmount: number
  taxAmount: number
  total: number
}

export interface SalePayment {
  id: string
  saleId: string
  branchId: string
  method: PaymentMethod
  amount: number
  reference?: string | null
}

export interface CashSession {
  id: string
  branchId: string
  staffId: string
  openedAt: number
  closedAt?: number | null
  openingFloat: number
  closingCash?: number | null
  expectedCash?: number | null
  cashVariance?: number | null
  status: 'open' | 'closed'
  note?: string | null
}

// ─── Customers ────────────────────────────────────────────────────────────────

export interface Customer {
  id: string
  branchId: string
  name: string
  phone: string
  email?: string | null
  address?: string | null
  loyaltyPoints: number
  creditBalance: number
  creditLimit: number
  totalPurchases: number
  isActive: boolean
  createdAt: number
  updatedAt: number
}

export type CreditTransactionType = 'top_up' | 'sale' | 'settlement' | 'adjustment'

export interface CreditTransaction {
  id: string
  customerId: string
  branchId: string
  type: CreditTransactionType
  amount: number
  balanceAfter: number
  referenceId?: string | null
  staffId: string
  note?: string | null
  createdAt: number
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface DailySalesReport {
  date: string
  totalSales: number
  totalTransactions: number
  totalCash: number
  totalCard: number
  totalMobilePay: number
  totalDiscount: number
  totalTax: number
  averageTransactionValue: number
}
// --- Suppliers ---

export interface Supplier {
  id: string
  branchId: string
  name: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  taxNumber?: string | null
  isActive: boolean
  createdAt: number
  updatedAt: number
}

// --- GRN (Goods Received Note) ---

export interface GRNItem {
  id: string
  grnId: string
  branchId: string
  productId: string
  productName?: string
  productSku?: string
  unitAbbr?: string
  qtyOrdered: number
  qtyReceived: number
  unitCost: number
  totalCost: number
}

export interface GRN {
  id: string
  branchId: string
  supplierId?: string | null
  supplierName?: string | null
  invoiceNumber?: string | null
  receivedAt: number
  totalCost: number
  status: string
  note?: string | null
  staffId: string
  createdAt: number
  items?: GRNItem[]
}

// --- Expiring Product ---

export interface ExpiringProduct {
  id: string
  name: string
  sku: string
  barcode?: string | null
  expiryDate: number
  categoryName?: string | null
  unitAbbr?: string | null
  qtyOnHand?: number | null
}


