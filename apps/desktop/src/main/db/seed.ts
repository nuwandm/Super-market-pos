import { createHash, randomBytes } from 'crypto'
import { getDb } from './index'
import * as schema from './schema'
import { eq } from 'drizzle-orm'

function hashPin(pin: string): { pinHash: string; pinSalt: string } {
  const pinSalt = randomBytes(16).toString('hex')
  const pinHash = createHash('sha256').update(pinSalt + pin).digest('hex')
  return { pinHash, pinSalt }
}

export async function seedDatabase(): Promise<void> {
  const db = getDb()

  // Check if already seeded
  const existing = await db.select().from(schema.supermarkets).limit(1)
  if (existing.length > 0) {
    console.log('[Seed] Database already seeded — skipping.')
    return
  }

  console.log('[Seed] Seeding initial data...')

  // 1. Create supermarket
  const supermarketId = crypto.randomUUID().replace(/-/g, '')
  await db.insert(schema.supermarkets).values({
    id: supermarketId,
    name: 'My Supermarket',
    currency: 'LKR',
    timezone: 'Asia/Colombo',
    taxRate: 0,
    receiptLanguage: 'en',
    receiptFooter: 'Thank you for shopping with us!',
  })

  // 2. Create branch
  const branchId = crypto.randomUUID().replace(/-/g, '')
  await db.insert(schema.branches).values({
    id: branchId,
    supermarketId,
    name: 'Main Branch',
    branchCode: 'MB',
    isActive: true,
  })

  // 3. Create super admin
  const adminId = crypto.randomUUID().replace(/-/g, '')
  const { pinHash, pinSalt } = hashPin('1234')
  await db.insert(schema.staff).values({
    id: adminId,
    branchId,
    name: 'Admin',
    staffCode: 'ADM001',
    role: 'super_admin',
    pinHash,
    pinSalt,
    isActive: true,
  })

  // 4. Create a cashier for demo
  const cashierId = crypto.randomUUID().replace(/-/g, '')
  const cashierPin = hashPin('1111')
  await db.insert(schema.staff).values({
    id: cashierId,
    branchId,
    name: 'Kasun Perera',
    staffCode: 'C001',
    role: 'cashier',
    pinHash: cashierPin.pinHash,
    pinSalt: cashierPin.pinSalt,
    isActive: true,
  })

  // 5. Create units
  const unitDefs = [
    { name: 'Piece',      abbreviation: 'pcs', isDecimal: false },
    { name: 'Kilogram',   abbreviation: 'kg',  isDecimal: true  },
    { name: 'Gram',       abbreviation: 'g',   isDecimal: true  },
    { name: 'Litre',      abbreviation: 'L',   isDecimal: true  },
    { name: 'Millilitre', abbreviation: 'ml',  isDecimal: true  },
    { name: 'Pack',       abbreviation: 'pk',  isDecimal: false },
    { name: 'Box',        abbreviation: 'box', isDecimal: false },
    { name: 'Dozen',      abbreviation: 'dz',  isDecimal: false },
  ]
  const unitIds: Record<string, string> = {}
  for (const u of unitDefs) {
    const id = crypto.randomUUID().replace(/-/g, '')
    unitIds[u.abbreviation] = id
    await db.insert(schema.units).values({ id, branchId, ...u })
  }

  // 6. Create categories
  const categoryDefs = [
    'Dairy & Eggs',
    'Beverages',
    'Bakery & Bread',
    'Rice & Grains',
    'Fruits & Vegetables',
    'Meat & Seafood',
    'Snacks & Confectionery',
    'Household & Cleaning',
    'Personal Care',
    'Baby & Kids',
  ]
  const categoryIds: Record<string, string> = {}
  for (let i = 0; i < categoryDefs.length; i++) {
    const id = crypto.randomUUID().replace(/-/g, '')
    categoryIds[categoryDefs[i]] = id
    await db.insert(schema.categories).values({
      id,
      branchId,
      name: categoryDefs[i],
      sortOrder: i,
      isActive: true,
    })
  }

  // 7. Create sample products
  const sampleProducts = [
    {
      name: 'Fresh Milk 1L',
      sku: 'PRD001',
      barcode: '4719865100017',
      categoryId: categoryIds['Dairy & Eggs'],
      unitId: unitIds['L'],
      costPrice: 180,
      sellingPrice: 220,
    },
    {
      name: 'White Sugar 1kg',
      sku: 'PRD002',
      barcode: '4719865100024',
      categoryId: categoryIds['Rice & Grains'],
      unitId: unitIds['kg'],
      costPrice: 155,
      sellingPrice: 195,
    },
    {
      name: 'White Bread',
      sku: 'PRD003',
      barcode: '4719865100031',
      categoryId: categoryIds['Bakery & Bread'],
      unitId: unitIds['pcs'],
      costPrice: 80,
      sellingPrice: 100,
    },
    {
      name: 'Coca-Cola 330ml',
      sku: 'PRD004',
      barcode: '5449000000439',
      categoryId: categoryIds['Beverages'],
      unitId: unitIds['ml'],
      costPrice: 65,
      sellingPrice: 85,
    },
    {
      name: 'Rice (Samba) 5kg',
      sku: 'PRD005',
      barcode: '4719865100048',
      categoryId: categoryIds['Rice & Grains'],
      unitId: unitIds['kg'],
      costPrice: 850,
      sellingPrice: 1050,
    },
    {
      name: 'Eggs (Dozen)',
      sku: 'PRD006',
      barcode: '4719865100055',
      categoryId: categoryIds['Dairy & Eggs'],
      unitId: unitIds['dz'],
      costPrice: 380,
      sellingPrice: 480,
    },
    {
      name: 'Washing Powder 1kg',
      sku: 'PRD007',
      barcode: '4719865100062',
      categoryId: categoryIds['Household & Cleaning'],
      unitId: unitIds['kg'],
      costPrice: 180,
      sellingPrice: 240,
    },
    {
      name: 'Biscuits (Marie)',
      sku: 'PRD008',
      barcode: '4719865100079',
      categoryId: categoryIds['Snacks & Confectionery'],
      unitId: unitIds['pcs'],
      costPrice: 55,
      sellingPrice: 75,
    },
  ]

  const productIdList: string[] = []
  for (const p of sampleProducts) {
    const id = crypto.randomUUID().replace(/-/g, '')
    productIdList.push(id)
    await db.insert(schema.products).values({
      id,
      branchId,
      reorderLevel: 10,
      reorderQty: 50,
      isActive: true,
      taxType: 'vat',
      ...p,
    })
    // Create inventory record
    const invId = crypto.randomUUID().replace(/-/g, '')
    await db.insert(schema.inventory).values({
      id: invId,
      branchId,
      productId: id,
      qtyOnHand: 100,
      qtyReserved: 0,
    })
    // Create opening stock movement
    await db.insert(schema.stockMovements).values({
      id: crypto.randomUUID().replace(/-/g, ''),
      branchId,
      productId: id,
      type: 'opening_stock',
      qtyBefore: 0,
      qtyChange: 100,
      qtyAfter: 100,
      staffId: adminId,
      note: 'Initial stock',
    })
  }

  console.log('[Seed] Complete.')
  console.log('[Seed] Login: staffCode=ADM001, PIN=1234')
  console.log('[Seed] Cashier: staffCode=C001, PIN=1111')
}
