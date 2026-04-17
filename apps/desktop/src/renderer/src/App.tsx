import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { useLicenseStore } from '@/stores/license.store'
import { api } from '@/lib/api'
import LoginPage from '@/pages/auth/LoginPage'
import AppShell from '@/components/layout/AppShell'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import POSPage from '@/pages/pos/POSPage'
import ProductsPage from '@/pages/products/ProductsPage'
import CategoriesPage from '@/pages/categories/CategoriesPage'
import InventoryPage from '@/pages/inventory/InventoryPage'
import SalesHistoryPage from '@/pages/sales/SalesHistoryPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import CustomersPage from '@/pages/customers/CustomersPage'
import ReportsPage from '@/pages/reports/ReportsPage'
import SetupPage from '@/pages/setup/SetupPage'
import ActivationPage from '@/pages/license/ActivationPage'
import SuppliersPage from '@/pages/suppliers/SuppliersPage'
import GRNPage from '@/pages/grn/GRNPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const session = useAuthStore((s) => s.session)
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { session, isLoading, setLoading, login, setContext } = useAuthStore()
  const { setLicense } = useLicenseStore()
  const navigate = useNavigate()

  useEffect(() => {
    async function boot() {
      try {
        // 1. Check license / setup status first
        const lic = await api.license.getStatus()
        if (lic.success && lic.data) {
          setLicense(lic.data)
          if (lic.data.status === 'not_setup') {
            navigate('/setup', { replace: true })
            setLoading(false)
            return
          }
          if (lic.data.status === 'trial_expired') {
            navigate('/activate', { replace: true })
            setLoading(false)
            return
          }
        }

        // 2. Restore session
        const res = await api.auth.getSession()
        if (res.success && res.data) {
          login(res.data)
          const ctx = await api.auth.getContext(res.data.branchId)
          if (ctx.success && ctx.data) {
            setContext(ctx.data.supermarket, ctx.data.branch)
          }
        }
      } catch {
        // continue — user will land on login
      }
      setLoading(false)
    }
    boot()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm animate-pulse">Starting...</div>
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-center" richColors toastOptions={{ style: { fontSize: '1rem' } }} />
      <Routes>
        {/* ── Public setup / activation ──────────────────────────── */}
        <Route path="/setup"    element={<SetupPage />} />
        <Route path="/activate" element={<ActivationPage />} />

        {/* ── Auth ───────────────────────────────────────────────── */}
        <Route
          path="/login"
          element={session ? <Navigate to="/pos" replace /> : <LoginPage />}
        />

        {/* ── Protected app ─────────────────────────────────────── */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/pos" replace />} />
          <Route path="pos"        element={<POSPage />} />
          <Route path="dashboard"  element={<DashboardPage />} />
          <Route path="products"   element={<ProductsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="inventory"  element={<InventoryPage />} />
          <Route path="sales"      element={<SalesHistoryPage />} />
          <Route path="customers"  element={<CustomersPage />} />
          <Route path="suppliers"  element={<SuppliersPage />} />
          <Route path="grn"        element={<GRNPage />} />
          <Route path="reports"    element={<ReportsPage />} />
          <Route path="settings"   element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
