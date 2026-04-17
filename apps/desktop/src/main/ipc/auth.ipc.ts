import { ipcMain } from 'electron'
import { createHash } from 'crypto'
import { eq, and, isNull } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../db/schema'

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
