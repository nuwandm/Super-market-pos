import { create } from 'zustand'

export type LicenseStatus = 'not_setup' | 'trial_valid' | 'trial_expired' | 'activated'

interface LicenseState {
  status:        LicenseStatus
  daysRemaining: number
  hardwareId:    string
  isChecked:     boolean

  setLicense: (data: { status: LicenseStatus; daysRemaining: number; hardwareId: string }) => void
}

export const useLicenseStore = create<LicenseState>((set) => ({
  status:        'not_setup',
  daysRemaining: 14,
  hardwareId:    '',
  isChecked:     false,

  setLicense: ({ status, daysRemaining, hardwareId }) =>
    set({ status, daysRemaining, hardwareId, isChecked: true }),
}))
