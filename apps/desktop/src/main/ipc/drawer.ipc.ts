import { ipcMain } from 'electron'
import { execSync } from 'child_process'

/**
 * Send ESC/POS cash-drawer kick command via a Windows serial (COM) port.
 * ESC p m t1 t2 — pin 2 kick: 0x1B 0x70 0x00 0x19 0xFA
 */
function kickDrawerSerial(port: string): void {
  const bytes = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA])
  const b64   = bytes.toString('base64')

  // Use PowerShell System.IO.Ports.SerialPort — no extra npm deps needed
  const script = `
$p = New-Object System.IO.Ports.SerialPort('${port}', 9600, 'None', 8, 'One')
$p.Open()
$p.Write([Convert]::FromBase64String('${b64}'), 0, 5)
Start-Sleep -Milliseconds 150
$p.Close()`

  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { timeout: 5_000 })
}

export function registerDrawerIPC(): void {
  ipcMain.handle('drawer:open', async (_e, port: string) => {
    try {
      if (!port || port === 'none') return { success: true }
      kickDrawerSerial(port)
      return { success: true }
    } catch (err) {
      console.error('[drawer:open]', err)
      return { success: false, error: 'Could not open cash drawer' }
    }
  })
}
