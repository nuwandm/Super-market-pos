import { ipcMain } from 'electron'
import { createHash, randomBytes } from 'crypto'
import { eq, and, isNull } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../db/schema'

const DEV_SECRET = 'DL@SuperPOS#ResetKey2024!'

function buildRequestCode(supermarketId: string, staffCode: string): { raw: string; formatted: string } {
  const raw = createHash('sha256')
    .update(supermarketId + staffCode.toUpperCase() + 'SUPERPOS_REQ')
    .digest('hex')
    .substring(0, 12)
    .toUpperCase()
  const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
  return { raw, formatted }
}

export function registerAuthIPC(): void {
  // auth:login — verify staffCode + PIN, return session
  ipcMain.handle('auth:login', async (_e, staffCode: string, pin: string) => {
    try {
      const db = getDb()
      const members = await db
        .select()
        .from(schema.staff)
        .where(and(eq(schema.staff.staffCode, staffCode), eq(schema.staff.isActive, true), isNull(schema.staff.deletedAt)))
        .limit(1)

      if (members.length === 0) {
        return { success: false, error: 'Staff ID not found' }
      }

      const member = members[0]
      const pinHash = createHash('sha256').update(member.pinSalt + pin).digest('hex')

      if (pinHash !== member.pinHash) {
        return { success: false, error: 'Incorrect PIN' }
      }

      return {
        success: true,
        data: {
          staffId:   member.id,
          staffName: member.name,
          staffCode: member.staffCode,
          role:      member.role,
          branchId:  member.branchId,
          loggedInAt: Date.now(),
        },
      }
    } catch (err) {
      console.error('[auth:login]', err)
      return { success: false, error: 'Login failed — please try again' }
    }
  })

  // auth:getSession — just returns null (session is in renderer store)
  ipcMain.handle('auth:getSession', async () => {
    return { success: true, data: null }
  })

  // auth:getSuperAdminCode — return the super admin's staff code (for forgot-PIN pre-fill)
  ipcMain.handle('auth:getSuperAdminCode', async () => {
    try {
      const db = getDb()
      const members = await db
        .select({ staffCode: schema.staff.staffCode })
        .from(schema.staff)
        .where(and(eq(schema.staff.role, 'super_admin'), eq(schema.staff.isActive, true), isNull(schema.staff.deletedAt)))
        .limit(1)
      if (members.length === 0) return { success: false, error: 'No super admin found' }
      return { success: true, data: { staffCode: members[0].staffCode } }
    } catch (err) {
      console.error('[auth:getSuperAdminCode]', err)
      return { success: false, error: 'Failed' }
    }
  })

  // auth:getRequestCode — generate a challenge code for super admin PIN reset
  ipcMain.handle('auth:getRequestCode', async (_e, staffCode: string) => {
    try {
      const db = getDb()
      const members = await db
        .select()
        .from(schema.staff)
        .where(and(eq(schema.staff.staffCode, staffCode.toUpperCase()), eq(schema.staff.isActive, true), isNull(schema.staff.deletedAt)))
        .limit(1)

      if (members.length === 0) return { success: false, error: 'Staff not found' }
      const member = members[0]
      if (member.role !== 'super_admin') return { success: false, error: 'Only super admin can use this feature' }

      const branches = await db
        .select()
        .from(schema.branches)
        .where(eq(schema.branches.id, member.branchId))
        .limit(1)
      if (branches.length === 0) return { success: false, error: 'Branch not found' }

      const { formatted } = buildRequestCode(branches[0].supermarketId, staffCode)
      return { success: true, data: { requestCode: formatted } }
    } catch (err) {
      console.error('[auth:getRequestCode]', err)
      return { success: false, error: 'Failed to generate request code' }
    }
  })

  // auth:resetSuperAdminPin — reset PIN using developer-issued reset key
  ipcMain.handle('auth:resetSuperAdminPin', async (_e, staffCode: string, resetKey: string, newPin: string) => {
    try {
      if (newPin.length < 4) return { success: false, error: 'PIN must be at least 4 digits' }

      const db = getDb()
      const members = await db
        .select()
        .from(schema.staff)
        .where(and(eq(schema.staff.staffCode, staffCode.toUpperCase()), eq(schema.staff.isActive, true), isNull(schema.staff.deletedAt)))
        .limit(1)

      if (members.length === 0) return { success: false, error: 'Staff not found' }
      const member = members[0]
      if (member.role !== 'super_admin') return { success: false, error: 'Only super admin can use this feature' }

      const branches = await db
        .select()
        .from(schema.branches)
        .where(eq(schema.branches.id, member.branchId))
        .limit(1)
      if (branches.length === 0) return { success: false, error: 'Branch not found' }

      const { raw: rawCode } = buildRequestCode(branches[0].supermarketId, staffCode)
      const expectedKey = createHash('sha256')
        .update(rawCode + DEV_SECRET + 'PINRESET')
        .digest('hex')
        .substring(0, 10)
        .toUpperCase()

      const providedKey = resetKey.replace(/-/g, '').toUpperCase()
      if (providedKey !== expectedKey) return { success: false, error: 'Invalid reset key' }

      const newSalt = randomBytes(16).toString('hex')
      const newHash = createHash('sha256').update(newSalt + newPin).digest('hex')
      await db.update(schema.staff).set({ pinSalt: newSalt, pinHash: newHash }).where(eq(schema.staff.id, member.id))

      return { success: true }
    } catch (err) {
      console.error('[auth:resetSuperAdminPin]', err)
      return { success: false, error: 'Failed to reset PIN' }
    }
  })

  // auth:getContext — returns supermarket + branch data
  ipcMain.handle('auth:getContext', async (_e, branchId: string) => {
    try {
      const db = getDb()
      const branches = await db
        .select()
        .from(schema.branches)
        .where(eq(schema.branches.id, branchId))
        .limit(1)

      if (branches.length === 0) return { success: false, error: 'Branch not found' }

      const branch = branches[0]
      const supermarkets = await db
        .select()
        .from(schema.supermarkets)
        .where(eq(schema.supermarkets.id, branch.supermarketId))
        .limit(1)

      return {
        success: true,
        data: {
          supermarket: supermarkets[0] ?? null,
          branch,
        },
      }
    } catch (err) {
      console.error('[auth:getContext]', err)
      return { success: false, error: 'Failed to load context' }
    }
  })
}
