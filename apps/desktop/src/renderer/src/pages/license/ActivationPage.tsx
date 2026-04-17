import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ShieldAlert, Copy, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { useLicenseStore } from '@/stores/license.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ActivationPage() {
  const hardwareId = useLicenseStore((s) => s.hardwareId)
  const navigate   = useNavigate()

  const [key,        setKey]        = useState('')
  const [activating, setActivating] = useState(false)
  const [copied,     setCopied]     = useState(false)

  function handleKeyChange(raw: string) {
    const digits = raw.toUpperCase().replace(/[^A-F0-9]/g, '')
    const parts: string[] = []
    for (let i = 0; i < Math.min(digits.length, 16); i += 4) {
      parts.push(digits.slice(i, i + 4))
    }
    setKey(parts.join('-'))
  }

  function copyMachineId() {
    navigator.clipboard.writeText(hardwareId).then(() => {
      setCopied(true)
      toast.success('Machine ID copied')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleActivate() {
    if (key.replace(/-/g, '').length < 16) {
      toast.error('Enter the full 16-character license key')
      return
    }
    setActivating(true)
    try {
      const res = await api.license.activate(key)
      if (!res.success) {
        toast.error(res.error ?? 'Invalid license key for this machine')
        return
      }
      toast.success('License activated!')
      setTimeout(() => navigate('/'), 1200)
    } catch {
      toast.error('Activation failed — please try again')
    } finally {
      setActivating(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">

        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
              <ShieldAlert className="h-7 w-7 text-destructive" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Trial Expired</h1>
          <p className="text-sm text-muted-foreground">
            Your 14-day trial has ended. Contact the developer to get your license key.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-5">

          {/* Machine ID */}
          <div className="space-y-1.5">
            <Label>Your Machine ID</Label>
            <p className="text-xs text-muted-foreground">
              Give this ID to the developer — they will generate your license key.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={hardwareId}
                className="font-mono text-xs tracking-wider"
              />
              <Button type="button" variant="outline" size="icon" onClick={copyMachineId} title="Copy">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* License key */}
          <div className="space-y-1.5">
            <Label htmlFor="licenseKey">License Key</Label>
            <Input
              id="licenseKey"
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="font-mono text-center tracking-widest text-lg uppercase"
              maxLength={19}
              autoFocus
            />
          </div>

          <Button
            className="w-full h-11"
            onClick={handleActivate}
            disabled={activating || key.replace(/-/g, '').length < 16}
          >
            {activating ? 'Activating...' : 'Activate License'}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          The license key is permanently bound to this computer.
        </p>
      </div>
    </div>
  )
}
