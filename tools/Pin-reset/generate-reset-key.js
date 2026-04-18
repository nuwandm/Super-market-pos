#!/usr/bin/env node
/**
 * Dream Labs — Super Admin PIN Reset Key Generator
 * Usage:  node generate-reset-key.js <REQUEST_CODE>
 * Example: node generate-reset-key.js AB12-CD34-EF56
 */

const { createHash } = require('crypto')

const DEV_SECRET = 'DL@SuperPOS#ResetKey2024!'

const input = process.argv[2]
if (!input) {
  console.error('Usage: node generate-reset-key.js <REQUEST_CODE>')
  console.error('Example: node generate-reset-key.js AB12-CD34-EF56')
  process.exit(1)
}

const rawCode = input.replace(/-/g, '').toUpperCase()
if (rawCode.length !== 12) {
  console.error(`Invalid request code length. Expected 12 chars (got ${rawCode.length}).`)
  process.exit(1)
}

const raw = createHash('sha256')
  .update(rawCode + DEV_SECRET + 'PINRESET')
  .digest('hex')
  .substring(0, 10)
  .toUpperCase()

const resetKey = `${raw.slice(0, 5)}-${raw.slice(5, 10)}`

console.log()
console.log('  Request Code :', input.toUpperCase())
console.log('  Reset Key    :', resetKey)
console.log()
