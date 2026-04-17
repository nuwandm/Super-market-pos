import React, { useState, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import dreamLabsLogo from '@/assets/dream-labs-logo.png'
import {
  ShoppingCart, LayoutDashboard, Package, Tag, Warehouse,
  History, Settings, Users, BarChart3, LogOut, Store, Clock,
  Truck, PackagePlus, MessageCircle, Mail, Phone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { useLicenseStore } from '@/stores/license.store'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  roles?: string[]
}

const navItems: NavItem[] = [
  { to: '/pos',        label: 'POS',         icon: ShoppingCart },
  { to: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/products',   label: 'Products',    icon: Package,   roles: ['super_admin','manager','stock_keeper'] },
  { to: '/categories', label: 'Categories',  icon: Tag,       roles: ['super_admin','manager'] },
  { to: '/inventory',  label: 'Inventory',   icon: Warehouse,    roles: ['super_admin','manager','stock_keeper'] },
  { to: '/suppliers',  label: 'Suppliers',   icon: Truck,        roles: ['super_admin','manager','stock_keeper'] },
  { to: '/grn',        label: 'GRN',         icon: PackagePlus,  roles: ['super_admin','manager','stock_keeper'] },
  { to: '/sales',      label: 'Sales',       icon: History,      roles: ['super_admin','manager','cashier'] },
  { to: '/customers',  label: 'Customers',   icon: Users,     roles: ['super_admin','manager','cashier'] },
  { to: '/reports',    label: 'Reports',     icon: BarChart3, roles: ['super_admin','manager'] },
  { to: '/settings',   label: 'Settings',    icon: Settings,  roles: ['super_admin','manager'] },
]

export default function Sidebar() {
  const { session, supermarket, logout } = useAuthStore()
  const { status, daysRemaining } = useLicenseStore()
  const navigate = useNavigate()
  const [showContact, setShowContact] = useState(false)
  const hideContactTimeout = useRef<ReturnType<typeof setTimeout>>()

  function handleContactEnter() {
    clearTimeout(hideContactTimeout.current)
    setShowContact(true)
  }
  function handleContactLeave() {
    hideContactTimeout.current = setTimeout(() => setShowContact(false), 150)
  }

  async function handleLogout() {
    try {
      await api.auth.getSession() // just to confirm we can call api
    } catch { /* ignore */ }
    logout()
    navigate('/login')
    toast.success('Logged out')
  }

  const role = session?.role ?? ''
  const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(role))

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary overflow-hidden shrink-0">
          {supermarket?.logoPath ? (
            <img src={supermarket.logoPath} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <Store className="h-4 w-4 text-primary-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{supermarket?.name ?? 'POS'}</p>
          <p className="text-xs text-muted-foreground">Supermarket</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Trial badge — click to open activation page */}
      {status === 'trial_valid' && (
        <NavLink
          to="/activate"
          className="mx-2 mb-2 flex items-center justify-between gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 hover:bg-amber-500/20 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
              Trial — {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
            </span>
          </div>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 underline underline-offset-2">
            Activate
          </span>
        </NavLink>
      )}

      {/* User info + logout */}
      <div className="border-t border-border px-3 py-2 flex items-center gap-2">
        <div className="flex-1 min-w-0 px-1">
          <p className="text-sm font-medium truncate">{session?.staffName}</p>
          <p className="text-xs text-muted-foreground capitalize">{session?.role?.replace('_', ' ')}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          title="Log out"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Vendor branding — hover for contact card */}
      <div
        className="relative px-3 pb-3 text-center cursor-pointer"
        onMouseEnter={handleContactEnter}
        onMouseLeave={handleContactLeave}
      >
        <p className="text-[10px] text-muted-foreground leading-relaxed select-none">
          Powered by<br />
          <span className="font-semibold text-foreground/60 hover:text-foreground/80 transition-colors">
            Dream Labs IT Solutions
          </span>
        </p>

        {/* Contact popup — appears to the right of the sidebar */}
        {showContact && (
          <div
              className="absolute bottom-0 left-full ml-3 w-60 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden"
              onMouseEnter={handleContactEnter}
              onMouseLeave={handleContactLeave}
            >
            {/* Header */}
            <div className="bg-primary px-4 py-3 flex items-center gap-3">
              <img src={dreamLabsLogo} alt="Dream Labs" className="h-14 w-14 rounded-full object-cover shrink-0" />
              <div className="text-left">
                <p className="text-primary-foreground font-bold text-sm leading-tight">Dream Labs</p>
                <p className="text-primary-foreground/70 text-xs">IT Solutions</p>
              </div>
            </div>

            {/* Contact details */}
            <div className="px-4 py-3 space-y-2.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contact Us</p>

              <a
                href="https://wa.me/94706151051"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors group"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-green-500/10 shrink-0">
                  <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[10px] text-muted-foreground">WhatsApp</p>
                  <p className="text-xs font-medium group-hover:text-green-600 transition-colors">070 615 1051</p>
                </div>
              </a>

              <a
                href="mailto:dreamlabsinfo12@gmail.com"
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-primary/5 transition-colors group"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 shrink-0">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[10px] text-muted-foreground">Email</p>
                  <p className="text-xs font-medium truncate group-hover:text-primary transition-colors">dreamlabsinfo12@gmail.com</p>
                </div>
              </a>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
