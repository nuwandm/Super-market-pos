import { ipcMain, shell, app } from 'electron'
import { createHash, randomBytes } from 'crypto'
import { join } from 'path'
import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import * as schema from '../db/schema'
import {
  getLicenseStatus,
  activateLicense,
  completeSetup,
} from '../license/license-manager'

function hashPin(pin: string): { pinHash: string; pinSalt: string } {
  const pinSalt = randomBytes(16).toString('hex')
  const pinHash = createHash('sha256').update(pinSalt + pin).digest('hex')
  return { pinHash, pinSalt }
}

export function registerLicenseIPC(): void {
  // ── shell:openExternal ────────────────────────────────────────────────────────
  ipcMain.handle('shell:openExternal', async (_e, url: string) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (err) {
      console.error('[shell:openExternal]', err)
      return { success: false, error: 'Failed to open URL' }
    }
  })


  // ── license:getStatus ────────────────────────────────────────────────────────
  ipcMain.handle('license:getStatus', async () => {
    try {
      const db     = getDb()
      const status = await getLicenseStatus(db)
      status.dbPath = join(app.getPath('userData'), 'supermarket-pos.db')
      return { success: true, data: status }
    } catch (err) {
      console.error('[license:getStatus]', err)
      return { success: false, error: 'Failed to read license status' }
    }
  })

  // ── license:activate ─────────────────────────────────────────────────────────
  ipcMain.handle('license:activate', async (_e, key: string) => {
    try {
      const db     = getDb()
      const result = await activateLicense(db, key)
      return result
    } catch (err) {
      console.error('[license:activate]', err)
      return { success: false, error: 'Activation failed' }
    }
  })

  // ── setup:complete ────────────────────────────────────────────────────────────
  // Creates supermarket, branch, super_admin + default units & categories,
  // then marks the trial as started.
  ipcMain.handle('setup:complete', async (_e, data: Record<string, unknown>) => {
    try {
      const db = getDb()

      const shopName    = (data.shopName    as string) || 'My Supermarket'
      const shopPhone   = (data.shopPhone   as string) || null
      const shopAddress = (data.shopAddress as string) || null
      const currency    = (data.currency    as string) || 'LKR'
      const ownerName   = (data.ownerName   as string) || 'Owner'
      const staffCode   = ((data.staffCode  as string) || 'ADM001').toUpperCase()
      const pin         = (data.pin         as string) || '1234'

      // 1. Supermarket
      const supermarketId = crypto.randomUUID().replace(/-/g, '')
      await db.insert(schema.supermarkets).values({
        id:              supermarketId,
        name:            shopName,
        phone:           shopPhone ?? undefined,
        address:         shopAddress ?? undefined,
        currency,
        timezone:        'Asia/Colombo',
        taxRate:         0,
        receiptLanguage: 'en',
        receiptFooter:   'Thank you for shopping with us!',
      })

      // 2. Branch
      const branchId = crypto.randomUUID().replace(/-/g, '')
      await db.insert(schema.branches).values({
        id:           branchId,
        supermarketId,
        name:         'Main Branch',
        branchCode:   'MB',
        isActive:     true,
      })

      // 3. Super admin
      const { pinHash, pinSalt } = hashPin(pin)
      await db.insert(schema.staff).values({
        id:        crypto.randomUUID().replace(/-/g, ''),
        branchId,
        name:      ownerName,
        staffCode,
        role:      'super_admin',
        pinHash,
        pinSalt,
        isActive:  true,
      })

      // 4. Default units
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
      for (const u of unitDefs) {
        await db.insert(schema.units).values({
          id: crypto.randomUUID().replace(/-/g, ''),
          branchId,
          ...u,
        })
      }

      // 5. Default categories
      const categoryDefs = [
        'Dairy & Eggs', 'Beverages', 'Bakery & Bread', 'Rice & Grains',
        'Fruits & Vegetables', 'Meat & Seafood', 'Snacks & Confectionery',
        'Household & Cleaning', 'Personal Care', 'Baby & Kids',
      ]
      for (let i = 0; i < categoryDefs.length; i++) {
        await db.insert(schema.categories).values({
          id:        crypto.randomUUID().replace(/-/g, ''),
          branchId,
          name:      categoryDefs[i],
          sortOrder: i,
          isActive:  true,
        })
      }

      // 6. Mark setup complete + start trial
      await completeSetup(db)

      console.log('[Setup] Complete. Owner:', ownerName, '| StaffCode:', staffCode)
      return { success: true }
    } catch (err) {
      console.error('[setup:complete]', err)
      return { success: false, error: 'Setup failed — please try again' }
    }
  })

  // ── app:resetSetup ────────────────────────────────────────────────────────────
  // Clears all app_config keys so the app returns to first-run setup on next launch.
  ipcMain.handle('app:resetSetup', async () => {
    try {
      const db = getDb()
      await db.delete(schema.appConfig)
      console.log('[app:resetSetup] Setup reset — app_config cleared')
      return { success: true }
    } catch (err) {
      console.error('[app:resetSetup]', err)
      return { success: false, error: 'Reset failed' }
    }
  })

  // ── app:getDbPath ─────────────────────────────────────────────────────────────
  ipcMain.handle('app:getDbPath', () => {
    return join(app.getPath('userData'), 'supermarket-pos.db')
  })
}
