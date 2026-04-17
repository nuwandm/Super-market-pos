import { ipcMain } from 'electron'
import { eq, and, isNull, asc } from 'drizzle-orm'
import { createHash, randomBytes } from 'crypto'
import { getDb } from '../db'
import * as schema from '../db/schema'

function hashPin(pin: string): { pinHash: string; pinSalt: string } {
  const pinSalt = randomBytes(16).toString('hex')
  const pinHash = createHash('sha256').update(pinSalt + pin).digest('hex')
  return { pinHash, pinSalt }
}

export function registerSettingsIPC(): void {
  // settings:getSupermarket
  ipcMain.handle('settings:getSupermarket', async () => {
    try {
      const db = getDb()
      const data = await db.select().from(schema.supermarkets).limit(1)
      return { success: true, data: data[0] ?? null }
    } catch (err) {
      console.error('[settings:getSupermarket]', err)
      return { success: false, error: 'Failed to load supermarket settings' }
    }
  })

  // settings:updateSupermarket
  ipcMain.handle('settings:updateSupermarket', async (_e, id: string, data: Record<string, unknown>) => {
    try {
      const db = getDb()
      // Whitelist only known schema columns to avoid injecting arbitrary keys
      const allowed = ['name','phone','email','address','currency','timezone','taxRate','vatNumber','receiptHeader','receiptFooter','receiptLanguage'] as const
      const safe: Record<string, unknown> = { updatedAt: Date.now() }
      for (const key of allowed) {
        if (key in data) safe[key] = data[key]
      }
      await db.update(schema.supermarkets)
        .set(safe as never)
        .where(eq(schema.supermarkets.id, id))
      console.log('[settings:updateSupermarket] updated id:', id, 'name:', safe['name'])
      return { success: true }
    } catch (err) {
      console.error('[settings:updateSupermarket]', err)
      return { success: false, error: 'Failed to save supermarket settings' }
    }
  })

  // settings:getBranch
  ipcMain.handle('settings:getBranch', async (_e, branchId: string) => {
    try {
      const db = getDb()
      const data = await db
        .select()
        .from(schema.branches)
        .where(eq(schema.branches.id, branchId))
        .limit(1)
      return { success: true, data: data[0] ?? null }
    } catch (err) {
      console.error('[settings:getBranch]', err)
      return { success: false, error: 'Failed to load branch settings' }
    }
  })

  // settings:updateBranch
  ipcMain.handle('settings:updateBranch', async (_e, id: string, data: Record<string, unknown>) => {
    try {
      const db = getDb()
      await db.update(schema.branches)
        .set({ ...data, updatedAt: Date.now() } as never)
        .where(eq(schema.branches.id, id))
      return { success: true }
    } catch (err) {
      console.error('[settings:updateBranch]', err)
      return { success: false, error: 'Failed to save branch settings' }
    }
  })

  // settings:getUnits
  ipcMain.handle('settings:getUnits', async (_e, branchId: string) => {
    try {
      const db = getDb()
      const data = await db
        .select()
        .from(schema.units)
        .where(and(eq(schema.units.branchId, branchId), isNull(schema.units.deletedAt)))
        .orderBy(asc(schema.units.name))
      return { success: true, data }
    } catch (err) {
      console.error('[settings:getUnits]', err)
      return { success: false, error: 'Failed to load units' }
    }
  })

  // settings:createUnit
  ipcMain.handle('settings:createUnit', async (_e, data: {
    branchId: string; name: string; abbreviation: string; isDecimal: boolean
  }) => {
    try {
      const db = getDb()
      const id = crypto.randomUUID().replace(/-/g, '')
      await db.insert(schema.units).values({ id, ...data })
      return { success: true, data: { id } }
    } catch (err) {
      console.error('[settings:createUnit]', err)
      return { success: false, error: 'Failed to create unit' }
    }
  })

  // settings:updateUnit
  ipcMain.handle('settings:updateUnit', async (_e, id: string, data: Record<string, unknown>) => {
    try {
      const db = getDb()
      await db.update(schema.units)
        .set({ ...data, updatedAt: Date.now() } as never)
        .where(eq(schema.units.id, id))
      return { success: true }
    } catch (err) {
      console.error('[settings:updateUnit]', err)
      return { success: false, error: 'Failed to update unit' }
    }
  })

  // settings:createStaff
  ipcMain.handle('settings:createStaff', async (_e, data: {
    branchId: string; name: string; username: string; pin: string; role: string
  }) => {
    try {
      const db       = getDb()
      const username = data.username.trim().toUpperCase()

      // Duplicate username check (across all active staff, not just this branch)
      const existing = await db
        .select({ id: schema.staff.id })
        .from(schema.staff)
        .where(and(eq(schema.staff.staffCode, username), isNull(schema.staff.deletedAt)))
        .limit(1)

      if (existing.length > 0) {
        return { success: false, error: `Username "${username}" is already taken` }
      }

      const id = crypto.randomUUID().replace(/-/g, '')
      const { pinHash, pinSalt } = hashPin(data.pin)
      await db.insert(schema.staff).values({
        id,
        branchId:  data.branchId,
        name:      data.name.trim(),
        staffCode: username,
        role:      data.role,
        pinHash,
        pinSalt,
        isActive:  true,
      })
      return { success: true, data: { id } }
    } catch (err) {
      console.error('[settings:createStaff]', err)
      return { success: false, error: 'Failed to create user' }
    }
  })

  // settings:updateStaff
  ipcMain.handle('settings:updateStaff', async (_e, id: string, data: {
    name?: string; role?: string; isActive?: boolean
  }) => {
    try {
      const db = getDb()
      await db.update(schema.staff)
        .set({ ...data, updatedAt: Date.now() } as never)
        .where(eq(schema.staff.id, id))
      return { success: true }
    } catch (err) {
      console.error('[settings:updateStaff]', err)
      return { success: false, error: 'Failed to update staff' }
    }
  })

  // settings:resetStaffPin
  ipcMain.handle('settings:resetStaffPin', async (_e, id: string, newPin: string) => {
    try {
      const db = getDb()
      const { pinHash, pinSalt } = hashPin(newPin)
      await db.update(schema.staff)
        .set({ pinHash, pinSalt, updatedAt: Date.now() })
        .where(eq(schema.staff.id, id))
      return { success: true }
    } catch (err) {
      console.error('[settings:resetStaffPin]', err)
      return { success: false, error: 'Failed to reset PIN' }
    }
  })

  // settings:getStaff
  ipcMain.handle('settings:getStaff', async (_e, branchId: string) => {
    try {
      const db = getDb()
      const data = await db
        .select({
          id:        schema.staff.id,
          branchId:  schema.staff.branchId,
          name:      schema.staff.name,
          staffCode: schema.staff.staffCode,
          role:      schema.staff.role,
          isActive:  schema.staff.isActive,
          createdAt: schema.staff.createdAt,
        })
        .from(schema.staff)
        .where(and(eq(schema.staff.branchId, branchId), isNull(schema.staff.deletedAt)))
        .orderBy(asc(schema.staff.name))
      return { success: true, data }
    } catch (err) {
      console.error('[settings:getStaff]', err)
      return { success: false, error: 'Failed to load staff' }
    }
  })
}
