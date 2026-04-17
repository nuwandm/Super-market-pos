import { ipcMain, dialog, app } from 'electron'
import { copyFileSync, existsSync } from 'fs'
import { join } from 'path'
import { closeDb, initDb } from '../db'

const DB_FILENAME = 'supermarket-pos.db'

function getDbPath(): string {
  return join(app.getPath('userData'), DB_FILENAME)
}

export function registerBackupIPC(): void {
  // backup:create — copy DB to user-chosen location
  ipcMain.handle('backup:create', async () => {
    try {
      const dbPath = getDbPath()
      if (!existsSync(dbPath)) return { success: false, error: 'Database file not found' }

      const now        = new Date()
      const dateStr    = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      const defaultName = `supermarket-pos-backup-${dateStr}.db`

      const result = await dialog.showSaveDialog({
        title:       'Save Database Backup',
        defaultPath: join(app.getPath('downloads'), defaultName),
        filters:     [{ name: 'SQLite Database', extensions: ['db'] }],
      })

      if (result.canceled || !result.filePath) return { success: false, error: 'Cancelled' }

      copyFileSync(dbPath, result.filePath)
      return { success: true, data: { path: result.filePath } }
    } catch (err) {
      console.error('[backup:create]', err)
      return { success: false, error: 'Backup failed' }
    }
  })

  // backup:restore — replace DB with user-chosen backup file (requires restart)
  ipcMain.handle('backup:restore', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title:       'Select Backup File to Restore',
        filters:     [{ name: 'SQLite Database', extensions: ['db'] }],
        properties:  ['openFile'],
      })

      if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'Cancelled' }

      const srcPath = result.filePaths[0]
      const dbPath  = getDbPath()

      // Close current DB connection before overwriting
      await closeDb()
      copyFileSync(srcPath, dbPath)
      // Re-open DB
      await initDb()

      return { success: true }
    } catch (err) {
      console.error('[backup:restore]', err)
      return { success: false, error: 'Restore failed' }
    }
  })
}
