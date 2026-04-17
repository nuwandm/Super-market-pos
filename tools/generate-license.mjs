#!/usr/bin/env node
/**
 * Supermarket POS — License Key Generator (CLI)
 *
 * Usage:
 *   node generate-license.mjs <MACHINE_ID>
 *
 * The Machine ID is displayed on the customer's screen when their trial expires
 * (ActivationPage).  They send it to you, you run this script, and send back
 * the License Key.
 *
 * IMPORTANT: Keep this script and LICENSE_SECRET private — never share with customers.
 */

import { createHmac } from 'crypto'

// ─── Must match LICENSE_SECRET in license-manager.ts exactly ─────────────────
const LICENSE_SECRET = 'POS_LICENSE_NUWANED_2024'

function generateKey(machineId) {
  const raw = createHmac('sha256', LICENSE_SECRET)
    .update(machineId.trim().toUpperCase())
    .digest('hex')
    .toUpperCase()
    .slice(0, 16)
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

const machineId = process.argv[2]

if (!machineId) {
  console.log('')
  console.log('  Usage:   node generate-license.mjs <MACHINE_ID>')
  console.log('')
  console.log('  Example: node generate-license.mjs ABCD1234EFGH5678ABCD1234EFGH5678')
  console.log('')
  process.exit(1)
}

if (!/^[A-F0-9]{32}$/i.test(machineId.trim())) {
  console.warn('\n  Warning: Machine ID should be a 32-character hex string.')
  console.warn('  Proceeding anyway...\n')
}

const key = generateKey(machineId)

console.log('')
console.log('  ╔══════════════════════════════════════════════════════╗')
console.log('  ║          Supermarket POS — License Generator         ║')
console.log('  ╚══════════════════════════════════════════════════════╝')
console.log('')
console.log(`  Machine ID   :  ${machineId.trim().toUpperCase()}`)
console.log(`  License Key  :  ${key}`)
console.log('')
console.log('  ──────────────────────────────────────────────────────')
console.log('  Give the License Key above to the customer.')
console.log('  They enter it on the Activation screen in the app.')
console.log('  ──────────────────────────────────────────────────────')
console.log('')
