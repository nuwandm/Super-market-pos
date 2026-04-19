import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Store, Building2, User, Check, Delete } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDot({ n, current }: { n: number; current: number }) {
  const done   = n < current
  const active = n === current
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors
          ${done   ? 'bg-primary text-primary-foreground'     : ''}
          ${active ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' : ''}
          ${!done && !active ? 'bg-muted text-muted-foreground border border-border' : ''}`}
      >
        {done ? <Check className="h-4 w-4" /> : n}
      </div>
    </div>
  )
}

// ─── PIN numpad (reused from LoginPage pattern) ───────────────────────────────

function PinInput({
  label,
  value,
  onChange,
  maxLength = 6,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  maxLength?: number
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex justify-center gap-2 py-1">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={`h-3 w-3 rounded-full border-2 transition-colors ${
              i < value.length ? 'bg-primary border-primary' : 'border-muted-foreground/40'
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['1','2','3','4','5','6','7','8','9'].map((d) => (
          <Button
            key={d}
            type="button"
            variant="outline"
            size="lg"
            className="text-xl font-semibold h-11"
            onClick={() => { if (value.length < maxLength) onChange(value + d) }}
          >
            {d}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11 text-xl font-semibold"
          onClick={() => { if (value.length < maxLength) onChange(value + '0') }}
        >
          0
        </Button>
        <div /> {/* spacer */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-11"
          onClick={() => onChange(value.slice(0, -1))}
        >
          <Delete className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SetupPage() {
  const navigate = useNavigate()

  const [step, setStep]         = useState(1)
  const [loading, setLoading]   = useState(false)

  // Step 1 — shop info
  const [shopName,    setShopName]    = useState('')
  const [shopPhone,   setShopPhone]   = useState('')
  const [shopAddress, setShopAddress] = useState('')
  const [currency,    setCurrency]    = useState('LKR')

  // Step 2 — owner account
  const [ownerName,  setOwnerName]  = useState('')
  const [staffCode,  setStaffCode]  = useState('')
  const [pin,        setPin]        = useState('')
  const [pinConfirm, setPinConfirm] = useState('')

  // ── Validation ───────────────────────────────────────────────────────────────

  function validateStep1() {
    if (!shopName.trim()) { toast.error('Shop name is required'); return false }
    return true
  }

  function validateStep2() {
    if (!ownerName.trim())       { toast.error('Owner name is required'); return false }
    if (!staffCode.trim())       { toast.error('Username is required'); return false }
    if (pin.length < 4)          { toast.error('PIN must be at least 4 digits'); return false }
    if (pin !== pinConfirm)      { toast.error('PINs do not match'); return false }
    return true
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setStep((s) => s + 1)
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setLoading(true)
    try {
      const res = await api.setup.complete({
        shopName:    shopName.trim(),
        shopPhone:   shopPhone.trim() || undefined,
        shopAddress: shopAddress.trim() || undefined,
        currency,
        ownerName:   ownerName.trim(),
        staffCode:   staffCode.trim().toUpperCase(),
        pin,
      })

      if (!res.success) {
        toast.error(res.error ?? 'Setup failed')
        return
      }

      toast.success('Setup complete! Your 14-day trial has started.')
      navigate('/login')
    } catch {
      toast.error('Setup failed — please try again')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
              <Store className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Welcome to Dream Labs POS</h1>
          <p className="text-sm text-muted-foreground">Set up your shop to start your 14-day free trial</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-4">
          <StepDot n={1} current={step} />
          <div className="h-px w-8 bg-border" />
          <StepDot n={2} current={step} />
          <div className="h-px w-8 bg-border" />
          <StepDot n={3} current={step} />
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">

          {/* ── Step 1: Shop info ─────────────────────────────────── */}
          {step === 1 && (
            <>
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Building2 className="h-4 w-4" />
                Step 1 of 3 — Shop Information
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="shopName">Shop Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="shopName"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="e.g. Perera Supermarket"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="shopPhone">Phone Number</Label>
                  <Input
                    id="shopPhone"
                    value={shopPhone}
                    onChange={(e) => setShopPhone(e.target.value)}
                    placeholder="e.g. +94 11 234 5678"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="shopAddress">Address</Label>
                  <Input
                    id="shopAddress"
                    value={shopAddress}
                    onChange={(e) => setShopAddress(e.target.value)}
                    placeholder="e.g. 123 Main Street, Colombo"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="currency">Currency</Label>
                  <select
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="LKR">LKR — Sri Lankan Rupee</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — British Pound</option>
                    <option value="INR">INR — Indian Rupee</option>
                  </select>
                </div>
              </div>

              <Button className="w-full h-11" onClick={handleNext}>
                Continue
              </Button>
            </>
          )}

          {/* ── Step 2: Owner account ─────────────────────────────── */}
          {step === 2 && (
            <>
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                Step 2 of 3 — Owner Account
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ownerName">Your Full Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="ownerName"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Nuwan Perera"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="staffCode">Username <span className="text-destructive">*</span></Label>
                  <Input
                    id="staffCode"
                    value={staffCode}
                    onChange={(e) => setStaffCode(e.target.value.toUpperCase())}
                    placeholder="e.g. NUWAN or ADMIN"
                    className="font-mono uppercase tracking-widest"
                  />
                </div>

                <PinInput
                  label="Create PIN (4–6 digits) *"
                  value={pin}
                  onChange={setPin}
                />

                <PinInput
                  label="Confirm PIN *"
                  value={pinConfirm}
                  onChange={setPinConfirm}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-11" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button className="flex-1 h-11" onClick={handleNext}>
                  Continue
                </Button>
              </div>
            </>
          )}

          {/* ── Step 3: Confirm & start trial ────────────────────── */}
          {step === 3 && (
            <>
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Check className="h-4 w-4" />
                Step 3 of 3 — Confirm & Start Trial
              </div>

              <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shop Name</span>
                  <span className="font-medium">{shopName}</span>
                </div>
                {shopPhone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-medium">{shopPhone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Currency</span>
                  <span className="font-medium">{currency}</span>
                </div>
                <div className="h-px bg-border my-1" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Owner</span>
                  <span className="font-medium">{ownerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Username</span>
                  <span className="font-mono font-medium">{staffCode}</span>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                Your <span className="font-semibold">14-day free trial</span> starts now.
                To continue using the app after the trial, you will need a license key from the developer.
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-11" onClick={() => setStep(2)} disabled={loading}>
                  Back
                </Button>
                <Button className="flex-1 h-11" onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Setting up...' : 'Start Free Trial'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
