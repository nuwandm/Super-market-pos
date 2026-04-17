/**
 * Developer License Key Generator
 * ---------------------------------
 * Usage:  node scripts/generate-license.mjs <HARDWARE_ID>
 *
 * The HARDWARE_ID is shown on the activation screen inside the app.
 * It is a 32-character uppercase hex string derived from the customer's machine.
 *
 * The generated key is unique to that machine and must match the SECRET
 * embedded in apps/desktop/src/main/license/license-manager.ts
 */

import { createHmac } from 'crypto'

const LICENSE_SECRET = 'POS_LICENSE_NUWANED_2024'

const hardwareId = process.argv[2]

if (!hardwareId || hardwareId.length < 8) {
  console.error('Usage: node scripts/generate-license.mjs <HARDWARE_ID>')
  console.error('The HARDWARE_ID is displayed on the activation screen in the app.')
  process.exit(1)
}

const raw = createHmac('sha256', LICENSE_SECRET)
  .update(hardwareId.trim().toUpperCase())
  .digest('hex')
  .toUpperCase()
  .slice(0, 16)

const key = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`

console.log()
console.log('  Hardware ID  :', hardwareId.trim().toUpperCase())
console.log('  License Key  :', key)
console.log()
