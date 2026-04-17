import { ipcMain, dialog, app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync, cpSync, rmSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { closeDb, initDb } from '../db'

const DB_FILENAME = 'supermarket-pos.db'
const IMAGES_DIR  = 'images'

function getDbPath():     string { return join(app.getPath('userData'), DB_FILENAME) }
function getImagesPath(): string { return join(app.getPath('userData'), IMAGES_DIR)  }

/** Run a PowerShell script via -EncodedCommand to avoid all cmd.exe escaping issues */
function runPS(script: string): void {
  // PowerShell -EncodedCommand expects UTF-16LE base64
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { timeout: 60_000 })
}

/** Escape a path for use inside a PowerShell single-quoted string */
function psPath(p: string): string {
  return p.replace(/'/g, "''")  // only single-quote needs escaping in PS literal strings
}

function zipPaths(sources: string[], destZip: string): void {
  const pathList = sources.map((p) => `'${psPath(p)}'`).join(',')
  runPS(`Compress-Archive -Path @(${pathList}) -DestinationPath '${psPath(destZip)}' -Force`)
}

function unzipTo(srcZip: string, destDir: string): void {
  runPS(`Expand-Archive -Path '${psPath(srcZip)}' -DestinationPath '${psPath(destDir)}' -Force`)
}

export function registerBackupIPC(): void {
  // backup:create — package DB + images folder into a .zip
  ipcMain.handle('backup:create', async () => {
    try {
      const dbPath = getDbPath()
      if (!existsSync(dbPath)) return { success: false, error: 'Database file not found' }

      const now         = new Date()
      const dateStr     = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      const defaultName = `supermarket-pos-backup-${dateStr}.zip`

      const result = await dialog.showSaveDialog({
        title:       'Save Full Backup',
        defaultPath: join(app.getPath('downloads'), defaultName),
        filters:     [{ name: 'Backup Archive', extensions: ['zip'] }],
      })

      if (result.canceled || !result.filePath) return { success: false, error: 'Cancelled' }

      // SQLite keeps the DB file locked while the app runs.
      // Copy it to a temp file first using Node (which handles shared file access),
      // then let PowerShell zip the unlocked copy.
      const userData   = app.getPath('userData')
      const tmpDir     = join(userData, '_backup_tmp')
      const tmpDbPath  = join(tmpDir, DB_FILENAME)
      mkdirSync(tmpDir, { recursive: true })
      copyFileSync(dbPath, tmpDbPath)   // Node can copy a shared-locked SQLite file

      const sources = [tmpDbPath]
      const imagesPath = getImagesPath()
      if (existsSync(imagesPath) && readdirSync(imagesPath).length > 0) {
        sources.push(imagesPath)
      }

      try {
        zipPaths(sources, result.filePath)
      } finally {
        // Clean up temp dir regardless of zip outcome
        try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
      }

      return { success: true, data: { path: result.filePath } }
    } catch (err) {
      console.error('[backup:create]', err)
      return { success: false, error: 'Backup failed' }
    }
  })

  // backup:restore — extract .zip and restore DB + images folder
  ipcMain.handle('backup:restore', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title:      'Select Backup File to Restore',
        filters:    [{ name: 'Backup Archive', extensions: ['zip', 'db'] }],
        properties: ['openFile'],
      })

      if (result.canceled || result.filePaths.length === 0) return { success: false, error: 'Cancelled' }

      const srcFile = result.filePaths[0]
      const dbPath  = getDbPath()
      const userData = app.getPath('userData')

      if (srcFile.endsWith('.db')) {
        // Legacy: plain .db restore
        await closeDb()
        copyFileSync(srcFile, dbPath)
        await initDb()
        return { success: true }
      }

      // ZIP restore
      const tempDir = join(userData, '_restore_tmp')
      mkdirSync(tempDir, { recursive: true })

      unzipTo(srcFile, tempDir)

      // Find the DB inside the extracted folder
      const extractedDb = join(tempDir, DB_FILENAME)
      if (!existsSync(extractedDb)) {
        return { success: false, error: 'Invalid backup: database file not found inside archive' }
      }

      await closeDb()
      copyFileSync(extractedDb, dbPath)

      // Restore images folder if present
      const extractedImages = join(tempDir, IMAGES_DIR)
      if (existsSync(extractedImages)) {
        const destImages = getImagesPath()
        mkdirSync(destImages, { recursive: true })
        cpSync(extractedImages, destImages, { recursive: true, force: true })
      }

      await initDb()

      // Clean up temp dir (best-effort)
      try { rmSync(tempDir, { recursive: true, force: true }) } catch { /* ignore */ }

      return { success: true }
    } catch (err) {
      console.error('[backup:restore]', err)
      return { success: false, error: 'Restore failed' }
    }
  })
}
