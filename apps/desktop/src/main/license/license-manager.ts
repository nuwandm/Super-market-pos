import { createHmac } from 'crypto'
import { eq } from 'drizzle-orm'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from '../db/schema'
import { getHardwareId } from './hardware-id'

const TRIAL_DAYS  = 14
const LICENSE_SECRET = 'POS_LICENSE_NUWANED_2024'

export type LicenseStatus =
  | 'not_setup'
  | 'trial_valid'
  | 'trial_expired'
  | 'activated'

export interface LicenseState {
  status:         LicenseStatus
  daysRemaining:  number
  hardwareId:     string
  dbPath?:        string
}

// ─── Key derivation (same algorithm used in generate-license.mjs) ─────────────

function deriveKey(hardwareId: string): string {
  const raw = createHmac('sha256', LICENSE_SECRET)
    .update(hardwareId)
    .digest('hex')
    .toUpperCase()
    .slice(0, 16)
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`
}

// ─── Config helpers ───────────────────────────────────────────────────────────

async function getConfig(
  db: LibSQLDatabase<typeof schema>,
  key: string
): Promise<string | null> {
  const rows = await db
    .select()
    .from(schema.appConfig)
    .where(eq(schema.appConfig.key, key))
    .limit(1)
  return rows[0]?.value ?? null
}

async function setConfig(
  db: LibSQLDatabase<typeof schema>,
  key: string,
  value: string
): Promise<void> {
  await db
    .insert(schema.appConfig)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.appConfig.key, set: { value } })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getLicenseStatus(
  db: LibSQLDatabase<typeof schema>
): Promise<LicenseState> {
  const hardwareId = getHardwareId()

  const setupComplete = await getConfig(db, 'setup_complete')
  if (setupComplete !== '1') {
    return { status: 'not_setup', daysRemaining: TRIAL_DAYS, hardwareId }
  }

  const isActivated = await getConfig(db, 'is_activated')
  if (isActivated === '1') {
    return { status: 'activated', daysRemaining: 0, hardwareId }
  }

  let trialStartRaw = await getConfig(db, 'trial_start')
  if (!trialStartRaw) {
    // trial_start missing — save it now so it persists across restarts
    trialStartRaw = Date.now().toString()
    await setConfig(db, 'trial_start', trialStartRaw)
  }
  const trialStart    = parseInt(trialStartRaw, 10)
  const elapsed       = Date.now() - trialStart
  const elapsedDays   = elapsed / (1000 * 60 * 60 * 24)
  const daysRemaining = Math.max(0, Math.floor(TRIAL_DAYS - elapsedDays))

  if (daysRemaining <= 0) {
    return { status: 'trial_expired', daysRemaining: 0, hardwareId }
  }

  return { status: 'trial_valid', daysRemaining, hardwareId }
}

export async function completeSetup(
  db: LibSQLDatabase<typeof schema>
): Promise<void> {
  const now = Date.now().toString()
  await setConfig(db, 'trial_start', now)
  await setConfig(db, 'setup_complete', '1')
  await setConfig(db, 'is_activated', '0')
}

export async function activateLicense(
  db: LibSQLDatabase<typeof schema>,
  inputKey: string
): Promise<{ success: boolean; error?: string }> {
  const hardwareId   = getHardwareId()
  const expectedKey  = deriveKey(hardwareId)
  const normalised   = inputKey.trim().toUpperCase()

  if (normalised !== expectedKey) {
    return { success: false, error: 'Invalid license key for this machine' }
  }

  await setConfig(db, 'license_key', normalised)
  await setConfig(db, 'is_activated', '1')
  return { success: true }
}
