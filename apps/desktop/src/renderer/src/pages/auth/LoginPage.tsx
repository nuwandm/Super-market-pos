import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import dreamLabsLogo from '@/assets/dream-labs-logo.png'
import { toast } from 'sonner'
import { Store, Delete, Keyboard, KeyRound, Copy, Check, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

export default function LoginPage() {
  const [staffCode,  setStaffCode]  = useState('')
  const [pin,        setPin]        = useState('')
  const [pinFocused, setPinFocused] = useState(false)
  const [loading,    setLoading]    = useState(false)
  const { login, setContext } = useAuthStore()
  const navigate    = useNavigate()
  const staffCodeRef = useRef<HTMLInputElement>(null)
  const handleLoginRef = useRef<() => Promise<void>>(null!)

  // Forgot PIN state
  const [forgotOpen,    setForgotOpen]    = useState(false)
  const [forgotStep,    setForgotStep]    = useState<1 | 2>(1)
  const [forgotCode,    setForgotCode]    = useState('')
  const [requestCode,   setRequestCode]   = useState('')
  const [resetKey,      setResetKey]      = useState('')
  const [newPinStr,     setNewPinStr]     = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [copied,        setCopied]        = useState(false)

  // Guard: if DB was reset, redirect to setup
  useEffect(() => {
    api.license.getStatus().then((res) => {
      if (res.success && res.data?.status === 'not_setup') {
        navigate('/setup', { replace: true })
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    staffCodeRef.current?.focus()
  }, [])

  function appendPin(digit: string) {
    if (pin.length < 6) setPin((p) => p + digit)
  }

  function deletePin() {
    setPin((p) => p.slice(0, -1))
  }

  async function handleLogin() {
    if (!staffCode.trim()) {
      toast.error('Enter your username')
      return
    }
    if (pin.length < 4) {
      toast.error('Enter your PIN (min 4 digits)')
      return
    }
    setLoading(true)
    try {
      const res = await api.auth.login(staffCode.trim().toUpperCase(), pin)
      if (!res.success) {
        toast.error(res.error ?? 'Invalid credentials')
        setPin('')
        return
      }
      login(res.data)
      const ctx = await api.auth.getContext(res.data.branchId)
      if (ctx.success && ctx.data) {
        setContext(ctx.data.supermarket, ctx.data.branch)
      }
      toast.success(`Welcome, ${res.data.staffName}`)
      navigate('/pos')
    } catch {
      toast.error('Login failed')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  // Keep a stable ref so the keydown handler always calls the latest version
  handleLoginRef.current = handleLogin

  // Keyboard PIN entry — fires when PIN area is focused
  useEffect(() => {
    if (!pinFocused) return

    function handler(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        setPin((p) => p.length < 6 ? p + e.key : p)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setPin((p) => p.slice(0, -1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleLoginRef.current()
      } else if (e.key === 'Escape') {
        setPinFocused(false)
        staffCodeRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pinFocused])

  function handleUsernameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      staffCodeRef.current?.blur()
      setPinFocused(true)
    } else if (e.key === 'Enter') {
      if (staffCode.trim()) {
        staffCodeRef.current?.blur()
        setPinFocused(true)
      }
    }
  }

  function enterPinMode() {
    staffCodeRef.current?.blur()
    setPinFocused(true)
  }

  async function openForgot() {
    setForgotStep(1)
    setRequestCode('')
    setResetKey('')
    setNewPinStr('')
    setCopied(false)
    setForgotOpen(true)
    // Auto-fill super admin username from DB
    try {
      const res = await api.auth.getSuperAdminCode()
      if (res.success && res.data?.staffCode) setForgotCode(res.data.staffCode)
      else setForgotCode(staffCode.trim().toUpperCase())
    } catch {
      setForgotCode(staffCode.trim().toUpperCase())
    }
  }

  function closeForgot() {
    setForgotOpen(false)
    setForgotStep(1)
    setForgotCode('')
    setRequestCode('')
    setResetKey('')
    setNewPinStr('')
    setCopied(false)
  }

  async function getRequestCode() {
    if (!forgotCode.trim()) { toast.error('Enter your username'); return }
    setForgotLoading(true)
    try {
      const res = await api.auth.getRequestCode(forgotCode.trim().toUpperCase())
      if (!res.success) { toast.error(res.error ?? 'Failed'); return }
      setRequestCode(res.data.requestCode)
      setForgotStep(2)
    } catch {
      toast.error('Failed to generate request code')
    } finally {
      setForgotLoading(false)
    }
  }

  async function doResetPin() {
    if (!resetKey.trim()) { toast.error('Enter the reset key from developer'); return }
    if (newPinStr.length < 4) { toast.error('New PIN must be at least 4 digits'); return }
    setForgotLoading(true)
    try {
      const res = await api.auth.resetSuperAdminPin(forgotCode.trim().toUpperCase(), resetKey.trim(), newPinStr)
      if (!res.success) { toast.error(res.error ?? 'Reset failed'); return }
      toast.success('PIN reset successfully. Please sign in with your new PIN.')
      closeForgot()
    } catch {
      toast.error('Reset failed')
    } finally {
      setForgotLoading(false)
    }
  }

  function copyRequestCode() {
    navigator.clipboard.writeText(requestCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background gap-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
              <Store className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Supermarket POS</h1>
          <p className="text-sm text-muted-foreground">Sign in with your username and PIN</p>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Username</label>
            <Input
              ref={staffCodeRef}
              value={staffCode}
              onChange={(e) => setStaffCode(e.target.value.toUpperCase())}
              onKeyDown={handleUsernameKeyDown}
              onFocus={() => setPinFocused(false)}
              placeholder="Enter your username"
              className="text-center text-lg font-mono tracking-widest uppercase"
              autoComplete="off"
            />
          </div>

          {/* PIN display — clickable to enter keyboard PIN mode */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">PIN</label>
              {pinFocused ? (
                <span className="flex items-center gap-1 text-xs text-primary font-medium">
                  <Keyboard className="h-3 w-3" />
                  Type digits on keyboard · Esc to cancel
                </span>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={enterPinMode}
                  tabIndex={-1}
                >
                  <Keyboard className="h-3 w-3" />
                  Use keyboard
                </button>
              )}
            </div>
            <button
              type="button"
              className={`w-full flex justify-center gap-2 py-3 rounded-lg border-2 transition-colors cursor-pointer ${
                pinFocused
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent hover:border-muted-foreground/20'
              }`}
              onClick={enterPinMode}
              tabIndex={-1}
              aria-label="Click to enter PIN via keyboard"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full border-2 transition-colors ${
                    i < pin.length
                      ? 'bg-primary border-primary'
                      : pinFocused
                        ? 'border-primary/40'
                        : 'border-muted-foreground/40'
                  }`}
                />
              ))}
            </button>
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2">
            {['1','2','3','4','5','6','7','8','9'].map((d) => (
              <Button
                key={d}
                variant="outline"
                size="lg"
                className="text-xl font-semibold h-12"
                onClick={() => { setPinFocused(false); appendPin(d) }}
                disabled={loading}
              >
                {d}
              </Button>
            ))}
            <Button
              variant="outline"
              size="lg"
              className="h-12 col-start-1 text-xl font-semibold"
              onClick={() => { setPinFocused(false); appendPin('0') }}
              disabled={loading}
            >
              0
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 col-start-3"
              onClick={deletePin}
              disabled={loading}
            >
              <Delete className="h-5 w-5" />
            </Button>
          </div>

          <Button
            className="w-full h-12 text-base"
            onClick={handleLogin}
            disabled={loading || pin.length < 4 || !staffCode.trim()}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>

          <div className="text-center pt-1">
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mx-auto"
              onClick={openForgot}
              tabIndex={-1}
            >
              <KeyRound className="h-3 w-3" />
              Forgot PIN? (Super Admin only)
            </button>
          </div>
        </div>
      </div>

      {/* Forgot PIN dialog */}
      <Dialog open={forgotOpen} onOpenChange={(o) => !o && closeForgot()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Reset Super Admin PIN
            </DialogTitle>
            <DialogDescription>
              {forgotStep === 1
                ? 'Generate a request code and send it to your developer to receive a reset key.'
                : 'Enter the reset key provided by your developer and set a new PIN.'}
            </DialogDescription>
          </DialogHeader>

          {forgotStep === 1 ? (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Username</label>
                <Input
                  value={forgotCode}
                  readOnly
                  placeholder="Loading..."
                  className="font-mono uppercase tracking-widest bg-muted text-muted-foreground"
                />
              </div>
              <Button className="w-full" onClick={getRequestCode} disabled={forgotLoading || !forgotCode.trim()}>
                {forgotLoading ? 'Generating...' : (
                  <span className="flex items-center gap-2">Get Request Code <ArrowRight className="h-4 w-4" /></span>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Request code display */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Your Request Code</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-md border border-border bg-muted px-3 py-2 font-mono text-lg font-bold tracking-widest text-center select-all">
                    {requestCode}
                  </div>
                  <Button variant="outline" size="icon" onClick={copyRequestCode} title="Copy">
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Send this code to your developer (WhatsApp: 070 615 1051)</p>
              </div>

              {/* Reset key input */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Reset Key (from developer)</label>
                <Input
                  value={resetKey}
                  onChange={(e) => setResetKey(e.target.value.toUpperCase())}
                  placeholder="XXXXX-XXXXX"
                  className="font-mono tracking-widest text-center"
                  autoComplete="off"
                  maxLength={11}
                />
              </div>

              {/* New PIN input */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">New PIN (4–6 digits)</label>
                <Input
                  type="password"
                  inputMode="numeric"
                  value={newPinStr}
                  onChange={(e) => setNewPinStr(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => { if (e.key === 'Enter') doResetPin() }}
                  placeholder="••••••"
                  className="text-center text-lg tracking-widest"
                  autoComplete="new-password"
                  maxLength={6}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setForgotStep(1)}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={doResetPin}
                  disabled={forgotLoading || !resetKey.trim() || newPinStr.length < 4}
                >
                  {forgotLoading ? 'Resetting...' : 'Reset PIN'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Vendor branding */}
      <div className="flex flex-col items-center gap-1.5">
        <img src={dreamLabsLogo} alt="Dream Labs IT Solutions" className="h-7 w-auto object-contain opacity-80" />
        <p className="text-xs text-muted-foreground">
          Powered by{' '}
          <span className="font-semibold text-foreground/80">Dream Labs IT Solutions</span>
        </p>
        <p className="text-xs text-muted-foreground">WhatsApp: 070 615 1051</p>
      </div>
    </div>
  )
}
