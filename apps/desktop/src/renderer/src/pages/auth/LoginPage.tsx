import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Store, Delete, Keyboard } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [staffCode,  setStaffCode]  = useState('')
  const [pin,        setPin]        = useState('')
  const [pinFocused, setPinFocused] = useState(false)
  const [loading,    setLoading]    = useState(false)
  const { login, setContext } = useAuthStore()
  const navigate    = useNavigate()
  const staffCodeRef = useRef<HTMLInputElement>(null)
  const handleLoginRef = useRef<() => Promise<void>>(null!)

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

  return (
    <div className="flex h-screen items-center justify-center bg-background">
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
        </div>
      </div>
    </div>
  )
}
