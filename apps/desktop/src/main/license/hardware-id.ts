import { createHash } from 'crypto'
import { cpus, hostname, networkInterfaces } from 'os'

/** Returns the first non-internal MAC address found, or empty string. */
function getMac(): string {
  const nets = networkInterfaces()
  for (const ifaces of Object.values(nets)) {
    if (!ifaces) continue
    for (const iface of ifaces) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        return iface.mac
      }
    }
  }
  return ''
}

/**
 * Generates a stable, hardware-bound identifier for this machine.
 * Returns a 32-character uppercase hex string (SHA-256 truncated).
 */
export function getHardwareId(): string {
  const cpu   = cpus()[0]?.model ?? 'unknown-cpu'
  const host  = hostname()
  const mac   = getMac()
  const raw   = `${cpu}|${host}|${mac}`
  return createHash('sha256').update(raw).digest('hex').toUpperCase().slice(0, 32)
}
