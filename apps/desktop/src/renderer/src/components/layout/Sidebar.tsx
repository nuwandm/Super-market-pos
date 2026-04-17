import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  ShoppingCart, LayoutDashboard, Package, Tag, Warehouse,
  History, Settings, Users, BarChart3, LogOut, Store, Clock,
  Truck, PackagePlus,
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
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
          <Store className="h-4 w-4 text-primary-foreground" />
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
      <div className="border-t border-border p-3 space-y-2">
        <div className="px-1">
          <p className="text-sm font-medium truncate">{session?.staffName}</p>
          <p className="text-xs text-muted-foreground capitalize">{session?.role?.replace('_', ' ')}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Log out
        </Button>
      </div>
    </aside>
  )
}
