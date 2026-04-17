# My SaaS Architecture Standard — Offline-First Desktop + Cloud

> **Who this is for:** Me (the developer). This is my personal technical standard for every
> business software product I build — POS, retail management, pharmacy, school admin, etc.
>
> **How to use:** At the start of any new project, give this document to Claude with the
> instruction: *"I am building a [retail shop / pharmacy / school] management system.
> Follow this architecture document exactly — same tech stack, same folder structure,
> same conventions. Research only the domain-specific modules and business logic."*
>
> **Strategy:** Simple → Sellable → Scalable
> **Model:** Sell offline first. Add cloud sync on demand. Scale to SaaS.

---

## 1. Business Model Pattern

Every product I build follows this tiered commercial model:

| Phase | What I Sell | Revenue Model |
|---|---|---|
| Phase 1 | Offline desktop app — core workflow | One-time license fee |
| Phase 2–3 | Business add-ons — inventory, reports, customers | Upsell to higher tier |
| Phase 4–5 | Cloud sync + multi-device + online features | Monthly SaaS subscription |
| Phase 6 | Multi-branch / Franchise + AI | Enterprise SaaS |

**Core value proposition for Sri Lanka (and similar developing markets):**
- Power cuts and poor internet are real — offline-first is non-negotiable
- Foreign enterprise software is expensive and not localized
- Start cheap, grow with the customer — each phase independently sellable

---

## 2. Tech Stack — Fixed Decisions

These choices are locked for all my projects. Never change without a very strong reason.

### 2.1 Application Layer

| Layer | Technology | Version | Reason for Choice |
|---|---|---|---|
| **Desktop Shell** | Electron | 31+ | Cross-platform, hardware access (USB, printer, drawer), web tech inside |
| **Frontend** | React + TypeScript | 18 + TS 5 | Component reuse, strict types, massive ecosystem |
| **Build Tool** | electron-vite | 2+ | Vite-speed HMR for both Electron main and renderer simultaneously |
| **Routing** | React Router DOM | 6 | Declarative routing, nested layouts, route-level state |
| **State** | Zustand | 4 | Zero boilerplate, composable slices, great devtools |
| **Forms** | React Hook Form + Zod | 7 + 3 | Uncontrolled = fast rerenders; Zod for schema validation |
| **Installer** | electron-builder | 24+ | NSIS Windows installer, code signing, auto-update support |

### 2.2 Local Database (Offline — Phase 1)

| Technology | Reason for Choice |
|---|---|
| **SQLite via `@libsql/client`** | Embedded, zero-config, fully async API — no Python/MSVC compile issues |
| **Drizzle ORM** | Type-safe SQL queries, schema-as-code, migration system, works with libsql |
| **drizzle-kit** | CLI to generate migration SQL from schema changes |

**Critical notes (always follow):**
- Use `@libsql/client` — NOT `better-sqlite3` (avoids Python + Visual C++ build issues on Windows)
- All DB calls must be `async/await` — no sync `.all()`, `.run()`, `.get()` methods
- Migrations live in `src/main/db/migrations/` and auto-run on app start via Drizzle's `migrate()`
- A `copyMigrationsPlugin` in `electron.vite.config.ts` copies SQL files → `out/main/migrations/` after each build

### 2.3 Cloud Backend (Phase 4+)

| Technology | Reason for Choice |
|---|---|
| **Node.js + Express** | Fast, low overhead, same JS/TS ecosystem |
| **MongoDB Atlas** | JSON-native, flexible schema, free tier, Change Streams for real-time sync |
| **Mongoose 8+** | Schema validation + middleware + lifecycle hooks for MongoDB |
| **JWT + Refresh Tokens** | Stateless auth, tokens cached locally for offline-friendly operation |
| **Socket.io** | Real-time push: online orders → desktop, live dashboards, driver tracking |

### 2.4 Additional Apps (Phase 4–6)

| App | Stack | Notes |
|---|---|---|
| **Online Ordering PWA** | React + Vite (deployed web) | Customer-facing, no install, runs in any browser |
| **Delivery / Field Agent App** | React PWA | GPS tracking, order status updates |
| **Owner Mobile App** | React Native + Expo | Code-shares types with web; dashboard + reports |
| **Cloud Dashboard** | React + Vite (web) | Owner portal, real-time sales, remote menu management |

---

## 3. Monorepo Structure

```
{project-root}/
├── apps/
│   ├── desktop/              ← Electron offline desktop app (Phase 1–3)
│   ├── cloud-api/            ← Node.js + Express cloud API (Phase 4+)
│   ├── ordering-pwa/         ← Customer-facing web app (Phase 4+)
│   └── driver-pwa/           ← Field agent / delivery driver app (Phase 5+)
├── packages/
│   └── shared-types/         ← TypeScript interfaces shared across ALL apps
├── package.json              ← npm workspaces root
└── architecture.md           ← This file
```

**npm workspaces** — single `node_modules` at root, inter-package references via `"*"` version.

---

## 4. Desktop App Folder Structure

This structure is fixed. Adapt only the page names to the domain.

```
apps/desktop/
├── electron.vite.config.ts         ← Vite config for main + preload + renderer
├── drizzle.config.ts               ← drizzle-kit config
├── src/
│   ├── main/                       ← Electron main process (Node.js context)
│   │   ├── index.ts                ← App entry: create window, register all IPC
│   │   ├── db/
│   │   │   ├── index.ts            ← initDb(), getDb(), closeDb(), migrate()
│   │   │   ├── schema.ts           ← ALL Drizzle table definitions in one file
│   │   │   ├── seed.ts             ← Dev/initial data (roles, default admin, samples)
│   │   │   └── migrations/
│   │   │       ├── 0000_initial.sql
│   │   │       ├── 0001_add_feature.sql
│   │   │       └── meta/_journal.json
│   │   └── ipc/                    ← ONE file per domain
│   │       ├── auth.ipc.ts
│   │       ├── {module-a}.ipc.ts   ← e.g. orders.ipc.ts, sales.ipc.ts
│   │       ├── {module-b}.ipc.ts
│   │       ├── settings.ipc.ts
│   │       └── reports.ipc.ts
│   ├── preload/
│   │   └── index.ts                ← contextBridge — exposes typed window.api
│   └── renderer/
│       └── src/
│           ├── main.tsx             ← React entry, font imports, router root
│           ├── App.tsx              ← Route tree definition
│           ├── components/
│           │   ├── ui/              ← shadcn/ui copied components (you own this code)
│           │   └── layout/
│           │       ├── AppShell.tsx           ← Auth guard + sidebar + Toaster
│           │       ├── Sidebar.tsx            ← Navigation sidebar
│           │       └── KeyboardShortcutsProvider.tsx
│           ├── pages/               ← One folder per feature module
│           │   ├── auth/            LoginPage.tsx
│           │   ├── dashboard/       DashboardPage.tsx
│           │   ├── {module-a}/      {ModuleA}Page.tsx
│           │   ├── {module-b}/      {ModuleB}Page.tsx
│           │   ├── settings/        SettingsPage.tsx   ← always tab-based
│           │   └── reports/         ReportsPage.tsx
│           ├── stores/              ← Zustand stores (one per domain)
│           │   └── auth.store.ts    ← Always present
│           ├── hooks/               ← Custom React hooks
│           │   └── useShortcut.ts
│           └── lib/                 ← Utilities and helpers
│               ├── api.ts           ← Proxy wrapper over window.api
│               ├── utils.ts         ← cn(), formatCurrency(), dateFormat(), etc.
│               └── receipt-i18n.ts  ← Multi-language document labels
```

---

## 5. IPC Architecture (Electron Communication Layer)

This is the core of an Electron app. The renderer (React UI) cannot touch the OS or DB directly — it must go through IPC.

```
Renderer (React UI)
    │  api.module.method(args)         ← via Proxy in lib/api.ts
    ▼
Preload (contextBridge)               ← the ONLY allowed bridge
    │  ipcRenderer.invoke('domain:action', args)
    ▼
Main Process (Node.js)
    │  ipcMain.handle('domain:action', async handler)
    ▼
SQLite DB (Drizzle ORM — always async)
```

### Channel Naming Convention
```
domain:action
───────────────────────────
auth:login
auth:getSession
orders:create
orders:getActive
orders:updateStatus
billing:checkout
settings:updateBranch
reports:getReport
```

### Preload Pattern (preload/index.ts)
```typescript
const api = {
  auth: {
    getSession:  ()                              => ipcRenderer.invoke('auth:getSession'),
    login:       (staffId: string, pin: string) => ipcRenderer.invoke('auth:login', staffId, pin),
  },
  orders: {
    getActive:    (branchId: string)              => ipcRenderer.invoke('orders:getActive', branchId),
    create:       (data: Record<string, unknown>) => ipcRenderer.invoke('orders:create', data),
    updateStatus: (id: string, status: string, staffId: string) =>
                  ipcRenderer.invoke('orders:updateStatus', id, status, staffId),
  },
  settings: {
    updateRestaurant: (id: string, data: Record<string, unknown>) =>
                      ipcRenderer.invoke('settings:updateRestaurant', id, data),
  },
  // ... all other domains
}
contextBridge.exposeInMainWorld('api', api)
export type Api = typeof api
```

### Renderer API Proxy (lib/api.ts)
```typescript
// Proxy wrapper — renderer uses this, never window.api directly
import type { Api } from '../../preload'
export const api = (window as unknown as { api: Api }).api
```

### IPC Handler Pattern (main/ipc/{domain}.ipc.ts)
```typescript
export function registerOrdersIPC() {
  ipcMain.handle('orders:create', async (_e, data: {
    branchId: string; staffId: string; orderType: string; items: unknown[]
  }) => {
    const db = getDb()
    const id = crypto.randomUUID().replace(/-/g, '')
    await db.insert(schema.orders).values({ id, ...data })
    return { success: true, id }
  })

  ipcMain.handle('orders:getActive', async (_e, branchId: string) => {
    return getDb().select().from(schema.orders)
      .where(and(eq(schema.orders.branchId, branchId), eq(schema.orders.status, 'active')))
  })
}
```

---

## 6. Database Design

### 6.1 SQLite Schema Rules (Drizzle)

```typescript
// schema.ts — syncCols added to EVERY syncable table
const syncCols = {
  syncId:      text('sync_id').default(sql`(lower(hex(randomblob(16))))`).notNull(),
  deviceId:    text('device_id'),
  syncedAt:    integer('synced_at'),       // Unix ms — null until synced to cloud
  syncVersion: integer('sync_version').default(0).notNull(),
  deletedAt:   integer('deleted_at'),      // soft-delete; null = active
  createdAt:   integer('created_at').default(sql`(unixepoch('now') * 1000)`).notNull(),
  updatedAt:   integer('updated_at').default(sql`(unixepoch('now') * 1000)`).notNull(),
}

// Example table
export const orders = sqliteTable('orders', {
  id:        text('id').primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  branchId:  text('branch_id').notNull(),     // ← always scope to branch
  staffId:   text('staff_id').notNull(),
  status:    text('status').default('active').notNull(),
  ...syncCols
})
```

**Non-negotiable rules:**
1. **UUID-style primary keys** — safe for multi-device, no collision when merging data
2. **Soft deletes only** — `deletedAt` timestamp; never hard-delete operational records
3. **Immutable financial records** — bills/payments are never edited, only reversed with a new record
4. **`branch_id` on every table** — mandatory from day one (multi-branch ready by design)
5. **Event sourcing for critical state** — e.g. `order_status_history` tracks every transition
6. **All timestamps as Unix milliseconds (INTEGER)** — never ISO strings in SQLite

### 6.2 Migration Convention

```
migrations/
├── 0000_initial.sql          ← Full CREATE TABLE statements
├── 0001_add_column.sql       ← ALTER TABLE only; never edit previous files
├── 0002_add_index.sql
└── meta/_journal.json        ← Drizzle registry (idx, tag, when)
```

- Never edit an existing migration file — always add a new one
- `initDb()` runs `migrate()` on every app start — new migrations apply automatically after rebuild
- To apply a migration to a live running DB without restart:
  ```javascript
  // Node.js one-liner (apply manually when needed)
  const db = new DatabaseSync(dbPath)
  db.exec("ALTER TABLE {table} ADD COLUMN {col} {type}")
  const hash = crypto.createHash('sha256').update(sqlFileContent).digest('hex')
  db.prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)").run(hash, Date.now())
  ```

### 6.3 Cloud MongoDB Conventions (Phase 4+)

```javascript
// Every synced document receives these fields
{
  _id: "{syncId}",      // = local SQLite syncId — seamless local ↔ cloud mapping
  branchId,             // always present — enables multi-branch queries
  syncedAt,             // timestamp of last sync event
  deviceId,             // originating device ID
  deletedAt: null,      // null = active; timestamp = soft deleted
}

// Schema decisions:
// ✅ EMBED for data always read together (e.g. order items inside order)
// ✅ REFERENCE by ID for shared/updated independently (e.g. menu items)

// Required indexes:
// - Compound: branchId + createdAt  (on all transaction collections)
// - Unique:   phone                 (customers)
// - Text:     name                  (products, items — for search)
```

---

## 7. Offline-First Architecture

```
┌─────────────────────────────────────┐
│         Electron Desktop App        │
│                                     │
│   React UI ◄── Zustand ◄── Drizzle  │
│                              │      │
│                           SQLite    │
│                         (local DB)  │
│                              │      │
└──────────────────────────────┼──────┘
                                │
                         [sync_queue]
                                │ (when online)
                        ┌───────▼──────┐
                        │  Cloud API   │
                        │  (Express)   │
                        └───────┬──────┘
                                │
                        ┌───────▼──────┐
                        │  MongoDB     │
                        │  Atlas       │
                        └──────────────┘
```

**Offline guarantee:** ALL local operations work 100% without internet. Network loss is invisible to staff.

### Sync Queue Table (in SQLite)
```sql
sync_queue (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type  TEXT NOT NULL,   -- e.g. 'order', 'sale', 'customer'
  entity_id    TEXT NOT NULL,   -- local UUID
  operation    TEXT NOT NULL,   -- 'create' | 'update' | 'delete'
  payload      TEXT NOT NULL,   -- JSON snapshot at time of mutation
  device_id    TEXT NOT NULL,
  branch_id    TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  synced_at    INTEGER,         -- null until successfully synced
  status       TEXT DEFAULT 'pending'  -- 'pending' | 'done' | 'conflict' | 'failed'
)
```

**Conflict resolution:** Server timestamp wins. Conflicts logged for manual review.
**Idempotency:** All sync API endpoints keyed on `syncId` — safe to replay, no duplicates.

---

## 8. UI Library Stack

### 8.1 Core

| Library | Version | Purpose |
|---|---|---|
| **shadcn/ui** | Latest | Component system — Button, Dialog, Sheet, Select, Table, Badge, Tabs, Switch, Dropdown |
| **Tailwind CSS** | v3 | Utility-first styling; no runtime overhead |
| **Radix UI** | via shadcn | Accessible primitives; installed automatically by shadcn |
| **Lucide React** | Latest | Icon library — 1,000+ consistent SVG icons |
| **Sonner** | Latest | Toast notification system — stacking, promise-based, rich content |
| **clsx + tailwind-merge** | Latest | Conditional class merging in `cn()` utility |
| **class-variance-authority** | Latest | Variant-based component API (used by shadcn internals) |

### 8.2 State & Forms

| Library | Purpose |
|---|---|
| **Zustand** | Global state — auth session, shopping cart, UI state |
| **React Hook Form** | Form management — uncontrolled inputs = no rerender per keystroke |
| **Zod** | Schema validation — forms, API responses, IPC data |
| **@hookform/resolvers** | Bridge between Zod schemas and React Hook Form |

### 8.3 Data & Charts (Phase 2+)

| Library | Purpose |
|---|---|
| **Recharts** | Charts — line, bar, pie, area — for reports and dashboards |
| **date-fns** | Date formatting, ranges, relative time |
| **cmdk** | Command palette — fast keyboard-driven search |
| **react-dnd** | Drag-and-drop — floor plans, kanban boards, sortable lists |
| **Framer Motion** | Micro-animations — status transitions, cart updates |

---

## 9. Typography System

### Three-Font Stack — Each with a Specific Job

#### Font 1: Plus Jakarta Sans — All UI Text
```bash
npm install @fontsource-variable/plus-jakarta-sans
```
- Variable font (100–800 weight range) — one file, all weights
- Geometric humanist: modern SaaS look, warm and readable at the same time
- Characters like `0 O D I l 1` are clearly distinct — no reading errors under pressure
- Renders well on 15.6" FHD touchscreens (common POS hardware in Sri Lanka)

#### Font 2: JetBrains Mono — Numbers, Amounts, Codes
```bash
npm install @fontsource/jetbrains-mono
```
- Every digit has identical width — prices in tables align perfectly without CSS tricks
- Clear distinction: `0 vs O`, `1 vs l vs I` — critical when reading amounts fast
- Apply to: all currency amounts, order/invoice numbers, stock quantities, serial numbers, license keys

#### Font 3: Noto Sans Sinhala + Tamil — Local Script Support
```bash
npm install @fontsource/noto-sans-sinhala @fontsource/noto-sans-tamil
```
- "Noto" = No Tofu — eliminates the □ placeholder boxes for unsupported characters
- Same visual weight as Plus Jakarta Sans — blends seamlessly in mixed-script UI
- Only production-grade free Sinhala font built for modern web rendering

### Font Imports (main.tsx — load ALL at startup)
```typescript
import '@fontsource-variable/plus-jakarta-sans'   // Primary UI font
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'
import '@fontsource/noto-sans-sinhala/400.css'
import '@fontsource/noto-sans-sinhala/700.css'
import '@fontsource/noto-sans-tamil/400.css'
```

### Tailwind Config
```javascript
// tailwind.config.js
theme: {
  extend: {
    fontFamily: {
      sans: ['Plus Jakarta Sans Variable', 'Noto Sans Sinhala', 'Noto Sans Tamil', 'sans-serif'],
      mono: ['JetBrains Mono', 'monospace'],
    },
  }
}
```

### Typography Scale

| Token | Font | Size | Weight | Use |
|---|---|---|---|---|
| Display | JetBrains Mono | 36px | 700 | Primary totals (bill total, change due) |
| Heading | Plus Jakarta Sans | 24px | 700 | Page titles, modal headings |
| Subheading | Plus Jakarta Sans | 18px | 600 | Section headers, card titles |
| Body | Plus Jakarta Sans | 16px | 400 | General text, descriptions |
| Label | Plus Jakarta Sans | 14px | 500 | Form labels, table column headers |
| Small | Plus Jakarta Sans | 12px | 400 | Timestamps, hints, sub-text |
| Amount | JetBrains Mono | 16px | 500 | Prices, quantities, stock |
| Amount-lg | JetBrains Mono | 24px | 700 | Summary totals |
| Code | JetBrains Mono | 14px | 400 | IDs, license keys, promo codes |

---

## 10. Color System — "Slate & Ember"

> High-readability in bright retail/restaurant floors and dim environments.
> Default: Light mode. Optional: Dark mode toggle per device.

### Base Palette

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `bg-base` | `#F1F5F9` | `#0F172A` | App background |
| `bg-surface` | `#FFFFFF` | `#1E293B` | Cards, panels, dialogs |
| `bg-surface-2` | `#F8FAFC` | `#334155` | Nested inputs, alternating rows |
| `border` | `#E2E8F0` | `#475569` | Dividers, input borders |
| `text-primary` | `#0F172A` | `#F8FAFC` | Main content |
| `text-muted` | `#64748B` | `#94A3B8` | Labels, placeholders, hints |

### Brand Color — Ember Orange
```
Primary:    #EA580C
Hover:      #C2410C
Light bg:   #FFF7ED  (tinted backgrounds, badges)
Dark:       #9A3412  (dark mode contrast)
```
Why orange: Appetite-stimulating, high contrast on both light/dark, instantly reads as "action" in operational software.

### Semantic Status Colors

| Status | Hex | Use |
|---|---|---|
| Success | `#16A34A` | Saved, paid, synced, done |
| Warning | `#D97706` | Low stock, slow printer, expiring soon |
| Danger | `#DC2626` | Void, cancel, delete, error, out of stock |
| Info | `#2563EB` | Sync status, tips, informational banners |

### Entity Status Color Pattern (adapt names per domain)

| Status | Hex | Example Domains |
|---|---|---|
| Available / Active | `#22C55E` | Table available, item in stock, staff on shift |
| In Use / Occupied | `#EF4444` | Table occupied, item on order, staff on break |
| Pending / Reserved | `#EAB308` | Table reserved, order pending, low stock |
| Processing / Cleaning | `#3B82F6` | Order preparing, table cleaning, transfer pending |
| Attention Needed | `#F97316` | Bill requested, reorder needed, overdue |
| Merged / Combined | `#F97316` | Merged tables, bundled orders |

### KDS / Live Queue Urgency (time-based)

| Elapsed | Hex | Signal |
|---|---|---|
| 0–5 min | `#22C55E` | On time |
| 5–10 min | `#EAB308` | Getting slow |
| 10+ min | `#EF4444` | Overdue — alert staff |

---

## 11. Authentication System

### Offline Auth (Phase 1)

- **PIN login** — 4-digit PIN per staff member, verified locally
- PIN stored as `SHA-256(salt + pin)` where salt = random 16-byte hex (per user, stored in DB)
- Session stored in Zustand (`auth.store.ts`) — clears on logout or app restart
- `AppShell.tsx` acts as route guard: no session → redirect to `/login`

```typescript
// auth.store.ts — always present in every project
interface AuthState {
  session:    Session | null     // logged-in staff/user record
  restaurant: Restaurant | null  // (or: company, school, shop — owner entity)
  branch:     Branch | null      // active location (or: outlet, campus, store)
  isLoading:  boolean
  login:      (session: Session) => void
  logout:     () => void
  setContext: (owner: OwnerEntity, branch: BranchEntity) => void
}
```

### Cloud Auth (Phase 4+)

- JWT + Refresh Tokens for owner/cloud accounts
- Tokens stored in Electron `safeStorage` (encrypted on disk)
- Staff still use PIN at the local terminal — offline auth always works
- All cloud API endpoints verify JWT + check `branchId` scope per request

### Role System (adapt names per domain)

```
super_admin  → all permissions, all branches (owner)
manager      → own branch management, reports, approvals
operator     → core workflow (POS, sales, transactions)
staff        → limited operations (take orders, serve)
viewer       → read-only (KDS, display screen)
```

---

## 12. Multi-Language Support

### Document/Receipt Language

```typescript
// lib/receipt-i18n.ts — translate all printed document labels
export type DocLang = 'en' | 'si' | 'ta'

export interface DocLabels {
  receipt: string; order: string; subtotal: string;
  tax: string; serviceCharge: string; discount: string;
  total: string; cash: string; card: string;
  change: string; thankYou: string;
  // Add domain-specific labels here
}

export const DOC_LABELS: Record<DocLang, DocLabels> = {
  en: { receipt: 'RECEIPT', subtotal: 'Subtotal', total: 'TOTAL', tax: 'Tax',
        serviceCharge: 'Service Charge', discount: 'Discount', cash: 'Cash',
        card: 'Card', change: 'Change', thankYou: 'Thank you for your visit!', ... },
  si: { receipt: 'රිසිට්පත', subtotal: 'උප එකතුව', total: 'එකතුව', tax: 'බදු',
        serviceCharge: 'සේවා ගාස්තු', discount: 'වට්ටම', cash: 'මුදල්',
        card: 'කාඩ්', change: 'ඉතිරිය', thankYou: 'ඔබේ පැමිණීමට ස්තූතියි!', ... },
  ta: { receipt: 'ரசீது', subtotal: 'கூட்டுத்தொகை', total: 'மொத்தம்', tax: 'வரி',
        serviceCharge: 'சேவை கட்டணம்', discount: 'தள்ளுபடி', cash: 'பணம்',
        card: 'கார்டு', change: 'மீதி', thankYou: 'வருகைக்கு நன்றி!', ... },
}

export function getDocLabels(lang?: string | null): DocLabels {
  return DOC_LABELS[(lang ?? 'en') as DocLang] ?? DOC_LABELS.en
}
```

- Language stored in the owner-entity table (e.g. `restaurants.receipt_language`)
- Selected in Settings → Receipt & Printing tab via 3 visual language cards
- Printing/billing page reads language from auth store, calls `getDocLabels()`

---

## 13. Settings Page Architecture

Settings are always structured at two levels:

| Level | DB Table | Scope |
|---|---|---|
| Owner Entity | `restaurants` / `companies` / `schools` | Global defaults — currency, timezone, tax, language |
| Branch / Location | `branches` / `outlets` / `campuses` | Per-location overrides of global defaults |

**Override pattern:**
```typescript
// Branch value wins if set, falls back to owner default
const effectiveTaxRate = branch?.taxRate ?? restaurant?.taxRate ?? 0
const effectiveFooter  = branch?.receiptFooter ?? restaurant?.receiptFooter ?? ''
```

### Settings Page — Always Tab-Based

```
Tab 1: [Building2]  {Owner Entity}         e.g. "Restaurant" / "Company" / "School"
   - Basic info: name, phone, email, address
   - Financial: currency, timezone, tax rate, service charge / fee
   - Default receipt / document footer

Tab 2: [MapPin]     {Branch / Location}    e.g. "Branch" / "Store" / "Campus"
   - Location info: name, phone, address
   - Local overrides: tax rate (null = use owner default)

Tab 3: [Receipt]    Receipt & Printing
   - Bill language selector (3 visual card buttons: English | සිංහල | தமிழ்)
   - Document header (location-specific)
   - Document footer override (location-specific)

Tab 4: [Shield]     Users & Roles          (Phase 2)
Tab 5: [Bell]       Notifications           (Phase 2)
Tab 6: [HardDrive]  Backup & Restore        (Phase 3)
Tab 7: [Key]        License                 (Phase 3)
```

---

## 14. Notification & Alert Patterns

### Which Component to Use

| Situation | Component | Behavior |
|---|---|---|
| Action completed | Sonner toast | Auto-dismiss in 3.5s |
| Background event | Sonner toast | Auto-dismiss |
| Irreversible action | AlertDialog (shadcn) | Blocks until user decides |
| Persistent state | Banner (top/bottom bar) | Stays until resolved |
| Form input error | Inline text below field | Never auto-dismisses |

### Sonner Toast Configuration (AppShell.tsx)
```tsx
<Toaster
  position="top-center"
  richColors
  expand={false}
  gap={8}
  toastOptions={{
    duration: 3500,
    style: { borderRadius: '12px' },
    classNames: {
      toast:       'shadow-lg border text-sm font-sans',
      title:       'font-semibold',
      description: 'text-xs opacity-80 mt-0.5',
    },
  }}
/>
```

### Toast Message Patterns

**Success:**
```typescript
toast.success('Payment confirmed', { description: 'Order #047 · LKR 1,134' })
toast.success('Record saved',      { description: 'Nimal Perera added' })
toast.success('Stock updated',     { description: 'Chicken: +5 kg' })
```

**Warning:**
```typescript
toast.warning('Low stock alert',  { description: 'Chicken below 2 kg — reorder now' })
toast.warning('Working offline',  { description: 'Changes saved locally. Sync when reconnected' })
```

**Error:**
```typescript
toast.error('Print failed',          { description: 'Check printer connection' })
toast.error('Save failed',           { description: 'Please try again' })
toast.error('Sync paused',           { description: 'Will retry automatically when online' })
```

**Promise toast (shows loading → success/error):**
```typescript
toast.promise(api.billing.checkout(data), {
  loading: 'Processing payment…',
  success: 'Payment confirmed',
  error:   'Payment failed, please try again',
})
```

### Confirmation Dialog Patterns

```
Destructive (irreversible) → Confirm button: RED
   "Delete this item?"            → "Past records unaffected."       → [Cancel] [Delete (red)]
   "Void this transaction?"       → "This cannot be undone."         → [Cancel] [Void (red)]
   "Restore from backup?"         → "Replaces all current data."     → [Cancel] [Restore (red)]

Financial (requires authority) → Confirm button: AMBER
   "Apply 35% discount?"         → "Manager PIN required."          → [Cancel] [Enter PIN (amber)]
   "Issue refund of LKR X?"      → "Cannot be reversed."            → [Cancel] [Confirm Refund (amber)]

Operational (safe navigation) → Confirm button: BRAND ORANGE
   "Close today's session?"       → "Finalizes all sales for today." → [Cancel] [Close Day (brand)]
   "Transfer to another branch?"  → "Data will move immediately."    → [Cancel] [Transfer (brand)]
```

### Inline Validation Messages

```
Empty required field  → "This field is required"
Invalid phone number  → "Enter a valid phone number (e.g. 0771 234 567)"
Zero price entered    → "Price must be greater than 0"
Negative quantity     → "Quantity cannot be negative"
Name too long         → "Keep the name under 60 characters"
PIN too short         → "PIN must be exactly 4 digits"
Duplicate entry       → "This {phone / email / name} is already in use"
Date in the past      → "Please select today or a future date"
```

### System Banners (persistent, until resolved)

```
[Blue]   "Working offline — changes saved locally and will sync when reconnected"
[Amber]  "Receipt printer not found — orders are still saving"
[Amber]  "License expires in 7 days — contact vendor to renew"
[Red]    "License expired — contact vendor to reactivate"
[Brand]  "New online order received — Order #47"
[Amber]  "1 record could not sync — tap to review"
```

---

## 15. Keyboard Shortcuts System

```typescript
// hooks/useShortcut.ts
// Register multiple shortcuts in any page component
useShortcut([
  { id: 'billing.confirm', action: () => handleConfirm() },  // Enter key
  { id: 'billing.cancel',  action: () => handleCancel()  },  // Escape key
  { id: 'billing.cash',    action: () => setMethod('cash') },
])
// ID convention: {pageDomain}.{action}
// e.g. pos.newOrder, kds.refresh, billing.confirm, customers.search
```

Global shortcuts (always active) registered in `KeyboardShortcutsProvider.tsx` inside `AppShell`.

---

## 16. License Key System (Offline Software Activation)

### Concept
App is locked until activated. Owner calls vendor, gets a one-time key. Works 100% offline.

### Flow
1. App shows "Not Activated" screen with a **Device ID** (`SHA-256(MAC address + hostname + OS platform)`)
2. Owner contacts vendor with their Device ID
3. Vendor runs: `node keygen.js <deviceId> <tier> <expiryDate>`
4. Vendor sends back Activation Key (format: `XXXXX-XXXXX-XXXXX-XXXXX-XXXXX`)
5. Owner enters key → app verifies offline (HMAC-SHA256 re-derivation, no server call)
6. License stored locally: `{ deviceId, licenseType, expiryDate, activationKey, activatedAt }`

### Cryptographic Algorithm
```
key = first-25-chars( HMAC-SHA256(deviceId + "|" + tier + "|" + expiryDate, VENDOR_SECRET) )
    → formatted as XXXXX-XXXXX-XXXXX-XXXXX-XXXXX

Verification (in app): re-derive with same inputs → compare → license valid/invalid
```

**Security:** Key is bound to Device ID — copying `license.json` to another machine fails.

### License Tiers (adapt per product)
```
starter     → Core module only
business    → + Inventory, customers, reports
pro         → + Cloud sync, multi-device, online features
enterprise  → + Multi-branch, API access, white-label, SLA
```

---

## 17. Backup & Data Recovery

### Backup File Format
`.posbackup` = ZIP archive:
- `data.db` — full SQLite database
- `metadata.json` — `{ version, backupDate, entityName, dbSizeBytes, checksum: "sha256:..." }`

### Backup Rules
- **Manual export** — Settings → Backup → Export (file picker → USB or Documents)
- **Auto backup** — on day-close + daily at configurable time (e.g. 11 PM)
- **Retention** — keep last 30 auto-backups, delete older
- **Cloud backup** — Phase 4+: also push to MongoDB Atlas or Google Drive

### Restore Flow
1. Validate ZIP structure
2. Verify SHA-256 checksum of embedded DB matches metadata
3. Auto-save a `pre-restore` backup before overwriting
4. Replace current DB file
5. Prompt app restart

---

## 18. Phase Plan Template

Use this structure for every new project. Rename module subjects to the domain.

### Phase 1 — Offline MVP (Weeks 1–4)
**Goal: First paying customer by end of week 4**
- Foundation: Electron + React + SQLite + Drizzle schema + Auth (PIN login)
- Core transaction module: The primary business workflow (order, sale, booking, enrollment)
- Secondary display module: A live-updating status view (KDS equivalent)
- Checkout / payment processing (cash + card + QR)
- Settings: entity info, fees/tax, receipt language, header/footer
- Windows installer build (electron-builder NSIS)

### Phase 2 — Business Features (Weeks 5–8)
- Inventory / stock tracking
- Customer / client database + loyalty points
- Full reporting suite (daily, monthly, category-wise)
- PDF + CSV/Excel export
- Staff / employee performance tracking

### Phase 3 — Hardware & UX Polish (Weeks 9–12)
- Thermal receipt printing (ESC/POS via USB/Network)
- Cash drawer trigger (via printer COM port)
- Barcode scanner integration (USB HID mode)
- Customer / secondary display (second Electron window)
- QR self-service (PWA on local network)
- Attendance tracking (clock-in/out, payroll summary)

### Phase 4 — Cloud System (Weeks 13–18)
- Cloud API: Express + MongoDB Atlas + Mongoose
- JWT auth, owner account, multi-device support
- Owner dashboard (web, real-time via WebSocket)
- Remote product/menu management
- Cloud backup
- Online ordering / booking PWA (customer-facing)
- Payment gateway integration

### Phase 5 — Sync Engine (Weeks 19–22)
- Offline → cloud sync queue + conflict resolution
- Multi-terminal support (2+ POS devices)
- Delivery / field agent PWA
- Customer self-service portal (order history, account)

### Phase 6 — Ecosystem (Months 6–12)
- Multi-branch / franchise management
- Consolidated cross-branch reporting
- AI features (demand forecasting, anomaly detection)
- 3rd-party integrations (delivery platforms, payment gateways)
- White-label / custom branding per branch
- React Native owner mobile app

---

## 19. Project Bootstrap Checklist

Run through this at the start of EVERY new project:

```
Infrastructure
[ ] Create monorepo: npm workspaces with apps/* and packages/*
[ ] Create packages/shared-types with base interfaces (Owner, Branch, Staff, Session)
[ ] Scaffold apps/desktop with electron-vite
[ ] Install core dependencies (see Section 2 and Section 8)

Tailwind + UI
[ ] Install and configure Tailwind CSS v3
[ ] Add tailwind.config.js with custom fontFamily (sans + mono)
[ ] Initialize shadcn/ui (copy Button, Dialog, Sheet, Select, Tabs, Switch, Badge at minimum)
[ ] Import all fonts in main.tsx (Plus Jakarta Sans, JetBrains Mono, Noto Sans SI + TA)

Database
[ ] Write Drizzle schema.ts — include syncCols on every syncable table
[ ] Run drizzle-kit generate → creates 0000_initial.sql
[ ] Build seed.ts with roles, default admin user, sample records
[ ] Set up initDb() calling migrate() on app startup
[ ] Add copyMigrationsPlugin to electron.vite.config.ts

IPC Layer
[ ] Write preload/index.ts with all domain APIs
[ ] Write lib/api.ts proxy wrapper
[ ] Create ipc/ folder with one file per domain
[ ] Register all IPC handlers in main/index.ts

UI Foundation
[ ] Build PIN login page (auth flow)
[ ] Build AppShell.tsx with auth guard, sidebar, and Sonner Toaster
[ ] Build Sidebar.tsx with navigation links
[ ] Add KeyboardShortcutsProvider to AppShell
[ ] Create auth.store.ts (session, ownerEntity, branch)

Localization
[ ] Create lib/receipt-i18n.ts with en / si / ta labels for this domain

Settings
[ ] Build SettingsPage.tsx as tab view (Owner | Branch | Receipt & Printing)

Packaging
[ ] Configure electron-builder in package.json (NSIS, appId, productName)
[ ] Create resources/icon.ico
[ ] Test full build: npm run build:win
```

---

## 20. Key Conventions — Quick Reference

| Convention | Rule |
|---|---|
| Timestamps | Unix milliseconds as INTEGER — never ISO strings in SQLite |
| Primary keys | `lower(hex(randomblob(16)))` — UUID-safe, collision-free |
| Soft deletes | `deletedAt` field — never hard-delete operational data |
| Financial records | Immutable — reverse with a new record, never edit existing |
| Branch scoping | `branch_id` on every table — multi-branch ready from day one |
| IPC channels | `domain:action` format — e.g. `orders:create`, `billing:checkout` |
| API access | Always via `api` proxy in renderer, NEVER `window.api` directly |
| Error messages | Never show raw DB errors or stack traces — always a friendly message |
| TypeScript | Strict mode everywhere; `// eslint-disable` only at IPC data boundaries |
| Toast position | Always `top-center`, `richColors`, no close button |
| Confirmations | Destructive = red, Financial = amber, Navigation = brand orange |
| Migrations | Always add a NEW file — never edit existing migration SQL |
| Stores | One Zustand store per domain (auth.store.ts, cart.store.ts, etc.) |
| Settings page | Always tab-based: Owner | Branch | Receipt & Printing |
| Language | `en` default — always build with Sinhala + Tamil from the start |

---

## 21. How to Use This Document for a New Project

When starting a new project (e.g. a retail shop management system):

**Prompt to give Claude:**
```
I am building a [DOMAIN] management system for Sri Lankan [business type].
Read architecture.md in this repo — it is my personal technical standard.
Follow the EXACT same tech stack, folder structure, IPC patterns, library choices,
and coding conventions described in that document.

Your job is ONLY to:
1. Research the domain-specific business logic and modules for [DOMAIN]
2. Design the SQLite schema tables specific to [DOMAIN]
3. Identify the IPC domains and their handlers
4. Map the pages/modules to the folder structure

Do NOT change any infrastructure decisions — stack, libraries, patterns, conventions
are all fixed by architecture.md. Only the domain content changes.

Domain: [e.g. retail shop — products, sales, customers, inventory, suppliers]
Target: Sri Lankan small/medium business, touchscreen POS hardware
License model: Offline one-time → Cloud SaaS tiers (same as architecture.md)
```

**What changes per project:**
- Schema table names and columns (adapt to domain entities)
- IPC domain names and methods
- Page names and UI flows
- Module list (phases 1–6 content)
- Receipt/document labels in `receipt-i18n.ts`

**What never changes:**
- Tech stack, library choices, versions
- Folder structure and naming conventions
- IPC architecture and communication pattern
- Auth system (PIN offline + JWT cloud)
- Sync queue pattern
- Toast configuration and message patterns
- Typography and color system
- Settings tab structure
- License key algorithm
- Backup file format

---

*This is my personal architecture standard. Every product I build uses this as the base.*
*The domain changes. The infrastructure never does.*

---

## 22. Full Dependency List (Exact Versions — Desktop App)

Copy-paste into `apps/desktop/package.json` and adjust `productName` / `appId` for each new project.

```json
{
  "dependencies": {
    "@pos/shared-types":                     "*",

    "@libsql/client":                        "^0.14.0",
    "drizzle-orm":                           "^0.44.0",

    "react":                                 "^18.3.1",
    "react-dom":                             "^18.3.1",
    "react-hook-form":                       "^7.51.3",
    "react-router-dom":                      "^6.23.1",
    "zustand":                               "^4.5.2",
    "zod":                                   "^3.23.8",
    "@hookform/resolvers":                   "^3.4.2",
    "sonner":                                "^1.4.41",
    "lucide-react":                          "^0.379.0",

    "clsx":                                  "^2.1.1",
    "tailwind-merge":                        "^2.3.0",
    "class-variance-authority":              "^0.7.0",

    "@radix-ui/react-dialog":                "^1.0.5",
    "@radix-ui/react-dropdown-menu":         "^2.0.6",
    "@radix-ui/react-label":                 "^2.0.2",
    "@radix-ui/react-select":                "^2.0.0",
    "@radix-ui/react-separator":             "^1.0.3",
    "@radix-ui/react-slot":                  "^1.0.2",
    "@radix-ui/react-switch":                "^1.0.3",
    "@radix-ui/react-tabs":                  "^1.0.4",
    "@radix-ui/react-toast":                 "^1.1.5",
    "@radix-ui/react-tooltip":               "^1.0.7",

    "@fontsource-variable/plus-jakarta-sans": "^5.0.21",
    "@fontsource/jetbrains-mono":            "^5.0.19",
    "@fontsource/noto-sans-sinhala":         "^5.0.16",
    "@fontsource/noto-sans-tamil":           "^5.0.16"
  },
  "devDependencies": {
    "typescript":            "^5.4.5",
    "@types/node":           "^20.14.2",
    "@types/react":          "^18.3.3",
    "@types/react-dom":      "^18.3.0",
    "@vitejs/plugin-react":  "^4.3.0",
    "autoprefixer":          "^10.4.19",
    "drizzle-kit":           "^0.30.0",
    "electron":              "^31.0.1",
    "electron-builder":      "^24.13.3",
    "electron-vite":         "^2.3.0",
    "postcss":               "^8.4.38",
    "tailwindcss":           "^3.4.4",
    "vite":                  "^5.3.1"
  },
  "build": {
    "appId": "com.{yourcompany}.{productname}",
    "productName": "{Product Name}",
    "directories": { "output": "dist" },
    "files": ["out/**/*"],
    "win": {
      "target": "nsis",
      "icon": "resources/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

### Phase 2+ additions (add when needed):
```json
{
  "recharts":       "^2.12.0",
  "date-fns":       "^3.6.0",
  "cmdk":           "^1.0.0",
  "react-dnd":      "^16.0.1",
  "react-dnd-html5-backend": "^16.0.1",
  "framer-motion":  "^11.2.0",
  "jspdf":          "^2.5.1",
  "xlsx":           "^0.18.5"
}
```

### Root `package.json` (monorepo):
```json
{
  "name": "{project}-monorepo",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev":         "npm run dev --workspace=apps/desktop",
    "build":       "npm run build --workspace=apps/desktop",
    "build:win":   "npm run build:win --workspace=apps/desktop",
    "api:dev":     "npm run dev --workspace=apps/cloud-api",
    "pwa:dev":     "npm run dev --workspace=apps/ordering-pwa",
    "types:build": "npm run build --workspace=packages/shared-types"
  },
  "devDependencies": {
    "typescript": "^5.4.5"
  }
}
```

---

## 23. Cloud API — Folder Structure + Express Middleware Stack

```
apps/cloud-api/
├── src/
│   ├── index.ts                  ← Express app entry: middleware stack + route mounting
│   ├── config/
│   │   ├── env.ts                ← Load + validate all env vars (fail fast if missing)
│   │   └── db.ts                 ← Mongoose connect + disconnect
│   ├── middleware/
│   │   ├── auth.middleware.ts    ← JWT verify → req.user
│   │   ├── branch.middleware.ts  ← branchId scope check → req.branch
│   │   ├── error.middleware.ts   ← Global error handler (last middleware)
│   │   ├── rateLimit.middleware.ts
│   │   └── validate.middleware.ts ← Zod body/params/query validation
│   ├── models/                   ← Mongoose schemas (one per collection)
│   │   ├── Owner.model.ts
│   │   ├── Branch.model.ts
│   │   ├── Staff.model.ts
│   │   ├── {entity}.model.ts     ← domain-specific (Order, Sale, Product…)
│   │   └── SyncQueue.model.ts
│   ├── routes/                   ← Express routers (one per domain)
│   │   ├── auth.routes.ts
│   │   ├── sync.routes.ts
│   │   ├── {domain}.routes.ts
│   │   └── webhook.routes.ts     ← Payment gateway callbacks
│   ├── controllers/              ← Route handler functions
│   │   ├── auth.controller.ts
│   │   ├── sync.controller.ts
│   │   └── {domain}.controller.ts
│   ├── services/                 ← Business logic (no Express coupling)
│   │   ├── auth.service.ts
│   │   ├── sync.service.ts
│   │   └── {domain}.service.ts
│   ├── socket/
│   │   ├── index.ts              ← Socket.io server setup + namespace registration
│   │   └── {domain}.socket.ts   ← Event handlers per domain
│   └── utils/
│       ├── jwt.ts                ← sign/verify tokens
│       ├── hash.ts               ← bcrypt wrappers
│       └── response.ts           ← Standardized API response helpers
├── package.json
└── tsconfig.json
```

### Express Middleware Stack (index.ts — ORDER MATTERS)

```typescript
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import { rateLimit } from 'express-rate-limit'
import { errorMiddleware } from './middleware/error.middleware'

const app = express()

// 1. Security headers first
app.use(helmet())

// 2. CORS — whitelist known origins
app.use(cors({
  origin: [process.env.DASHBOARD_URL!, process.env.PWA_URL!],
  credentials: true,
}))

// 3. Body parsing
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// 4. Compression
app.use(compression())

// 5. Global rate limiting
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }))

// 6. Routes
app.use('/api/v1/auth',    authRoutes)
app.use('/api/v1/sync',    syncRoutes)    // requires auth middleware inside
app.use('/api/v1/{domain}', domainRoutes) // requires auth + branch scope inside

// 7. Error handler — MUST be last
app.use(errorMiddleware)
```

### Standardized API Response Shape
```typescript
// ALL API responses follow this shape
{
  "success": true,
  "data": { ... }       // on success
}
{
  "success": false,
  "error": {
    "code":    "UNAUTHORIZED",
    "message": "Token expired or invalid"
  }
}
```

### Cloud API `package.json` dependencies
```json
{
  "dependencies": {
    "express":           "^4.19.0",
    "mongoose":          "^8.4.0",
    "jsonwebtoken":      "^9.0.0",
    "bcryptjs":          "^2.4.3",
    "helmet":            "^7.1.0",
    "cors":              "^2.8.5",
    "compression":       "^1.7.4",
    "express-rate-limit":"^7.3.0",
    "zod":               "^3.23.8",
    "socket.io":         "^4.7.5",
    "dotenv":            "^16.4.5",
    "winston":           "^3.13.0"
  },
  "devDependencies": {
    "typescript":        "^5.4.5",
    "@types/express":    "^4.17.21",
    "@types/node":       "^20.14.2",
    "tsx":               "^4.15.0",
    "nodemon":           "^3.1.0"
  }
}
```

---

## 24. Mongoose Model Patterns (Cloud — Phase 4+)

All cloud models follow the same structural rules. Replace `orders` with your domain entity.

```typescript
// models/Order.model.ts
import { Schema, model, Document } from 'mongoose'

export interface IOrder extends Document {
  _id:         string          // = local SQLite syncId
  branchId:    string
  restaurantId:string
  staffId:     string
  orderType:   'dine_in' | 'takeaway' | 'delivery'
  status:      'active' | 'printed' | 'ready' | 'paid' | 'cancelled'
  items:       Array<{         // embedded — always read together
    menuItemId: string
    name:       string
    qty:        number
    unitPrice:  number
    total:      number
  }>
  subtotal:    number
  taxAmount:   number
  total:       number
  deviceId:    string
  syncedAt:    number          // Unix ms
  deletedAt:   number | null
  createdAt:   number          // Unix ms (from local device)
  updatedAt:   number
}

const orderSchema = new Schema<IOrder>({
  _id:          { type: String, required: true },  // = syncId from SQLite
  branchId:     { type: String, required: true, index: true },
  restaurantId: { type: String, required: true, index: true },
  staffId:      { type: String, required: true },
  orderType:    { type: String, enum: ['dine_in','takeaway','delivery'], required: true },
  status:       { type: String, default: 'active' },
  items:        [{ menuItemId: String, name: String, qty: Number,
                   unitPrice: Number, total: Number }],
  subtotal:     { type: Number, required: true },
  taxAmount:    { type: Number, default: 0 },
  total:        { type: Number, required: true },
  deviceId:     String,
  syncedAt:     { type: Number, default: () => Date.now() },
  deletedAt:    { type: Number, default: null },
  createdAt:    { type: Number, required: true },
  updatedAt:    { type: Number, required: true },
}, {
  _id: false,           // we manage _id ourselves (syncId)
  timestamps: false,    // we manage createdAt/updatedAt ourselves (Unix ms from device)
  versionKey: false,
})

// Required indexes on every transaction collection
orderSchema.index({ branchId: 1, createdAt: -1 })  // list queries
orderSchema.index({ branchId: 1, status: 1 })       // active orders filter
orderSchema.index({ _id: 1 }, { unique: true })      // upsert by syncId

export const Order = model<IOrder>('Order', orderSchema)
```

### Rules
- `_id` is always the local `syncId` (hex UUID from SQLite) — seamless upsert
- Timestamps as Unix milliseconds (stay consistent with SQLite convention)
- `timestamps: false` and `versionKey: false` — we own these fields
- **Embed** arrays that are always loaded with the parent (order items, bill lines)
- **Reference by `_id`** for entities updated independently (staff, menu items, customers)
- Always add compound index on `(branchId, createdAt)` on transaction collections
- Soft-delete: `deletedAt: null` = active; set to Unix ms to mark deleted

---

## 25. Sync Engine — Algorithm

The sync engine runs in the **Electron main process** as a background worker.

### SQLite `sync_queue` Table
Every write operation that should reach the cloud inserts a row here:
```typescript
// Inside each IPC handler, after local DB write:
await db.insert(schema.syncQueue).values({
  id:          crypto.randomUUID(),
  entityType:  'order',
  entityId:    order.id,
  operation:   'create',         // 'create' | 'update' | 'delete'
  payload:     JSON.stringify(order),
  deviceId,
  branchId,
  createdAt:   Date.now(),
  status:      'pending',        // pending | done | failed | conflict
})
```

### Flush Algorithm (runs every 30 seconds + on reconnect)

```typescript
async function flushSyncQueue() {
  if (!isOnline || isFlushing) return
  isFlushing = true

  const pending = await db.select()
    .from(schema.syncQueue)
    .where(eq(schema.syncQueue.status, 'pending'))
    .orderBy(asc(schema.syncQueue.createdAt))
    .limit(50)                   // process in batches of 50

  for (const item of pending) {
    try {
      await api.post(`/sync/${item.entityType}`, {
        operation: item.operation,
        payload:   JSON.parse(item.payload),
        deviceId:  item.deviceId,
        branchId:  item.branchId,
      })
      // Mark done in local DB
      await db.update(schema.syncQueue)
        .set({ status: 'done', syncedAt: Date.now() })
        .where(eq(schema.syncQueue.id, item.id))
    } catch (err: unknown) {
      const status = err instanceof Error && 'status' in err
        ? (err as { status: number }).status : 0
      if (status === 409) {
        // Conflict — server record is newer; mark for manual review
        await db.update(schema.syncQueue)
          .set({ status: 'conflict' })
          .where(eq(schema.syncQueue.id, item.id))
      } else {
        // Network / server error — will retry next cycle
        await db.update(schema.syncQueue)
          .set({ status: 'failed' })
          .where(eq(schema.syncQueue.id, item.id))
      }
    }
  }
  isFlushing = false
}

// Start periodic flush
setInterval(flushSyncQueue, 30_000)

// Also flush immediately on reconnect
app.on('web-contents-created', (_, contents) => {
  contents.on('did-navigate', flushSyncQueue)
})
```

### Cloud Sync Endpoint (Express — idempotent upsert)

```typescript
// POST /api/v1/sync/:entityType
export async function syncEntity(req: Request, res: Response) {
  const { operation, payload, deviceId, branchId } = req.body
  const Model = getModel(req.params.entityType) // Order, Customer, etc.

  if (operation === 'create' || operation === 'update') {
    await Model.findOneAndUpdate(
      { _id: payload.syncId },              // match by syncId = idempotent
      { ...payload, syncedAt: Date.now() },
      { upsert: true, new: true }
    )
  } else if (operation === 'delete') {
    await Model.updateOne(
      { _id: payload.syncId },
      { deletedAt: Date.now() }
    )
  }
  return res.json({ success: true })
}
```

### Conflict Resolution Rules
1. **Server timestamp wins** — if `updatedAt` in DB > `updatedAt` in payload → server wins
2. **Financial records never overwrite** — bills/payments are immutable; only new records sync
3. **Conflicts logged** — stored in `sync_queue.status = 'conflict'` for manual review in owner dashboard
4. **No automatic merge** — never merge two conflicting records automatically

---

## 26. Electron Main Process Patterns

### Window Creation (`main/index.ts`)

```typescript
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { initDb, closeDb } from './db'
import { registerAllIPC } from './ipc'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1280,
    height:          800,
    minWidth:        1024,
    minHeight:       700,
    frame:           true,
    titleBarStyle:   'default',
    webPreferences: {
      preload:          join(__dirname, '../preload/index.js'),
      contextIsolation: true,    // ALWAYS true — security requirement
      nodeIntegration:  false,   // ALWAYS false — security requirement
      sandbox:          false,   // false needed for @libsql/client
    },
  })

  // Dev: load Vite dev server. Prod: load built HTML
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Open external links in system browser, not Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(async () => {
  await initDb()      // run migrations, init connection
  registerAllIPC()    // register all ipcMain.handle() calls
  createWindow()
})

app.on('window-all-closed', async () => {
  await closeDb()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
```

### Register All IPC (`main/ipc/index.ts`)

```typescript
import { registerAuthIPC }     from './auth.ipc'
import { registerOrdersIPC }   from './orders.ipc'
import { registerBillingIPC }  from './billing.ipc'
import { registerSettingsIPC } from './settings.ipc'
import { registerReportsIPC }  from './reports.ipc'
// ... add new domain imports here

export function registerAllIPC() {
  registerAuthIPC()
  registerOrdersIPC()
  registerBillingIPC()
  registerSettingsIPC()
  registerReportsIPC()
}
```

### DB Initialization (`main/db/index.ts`)

```typescript
import { createClient, Client } from '@libsql/client'
import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { join } from 'path'
import { app } from 'electron'
import * as schema from './schema'

let db: LibSQLDatabase<typeof schema>
let client: Client

export async function initDb() {
  const dbPath = join(app.getPath('userData'), 'app.db')
  client = createClient({ url: `file:${dbPath}` })
  db = drizzle(client, { schema })
  // Apply any new migration SQL files automatically
  await migrate(db, { migrationsFolder: join(__dirname, 'migrations') })
}

export function getDb() {
  if (!db) throw new Error('DB not initialised — call initDb() first')
  return db
}

export async function closeDb() {
  client?.close()
}
```

### System Tray (Phase 2+ — optional)

```typescript
import { Tray, Menu, nativeImage } from 'electron'

let tray: Tray | null = null

function createTray() {
  const icon = nativeImage.createFromPath(join(__dirname, '../../resources/icon.ico'))
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('POS App')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open', click: () => mainWindow?.show() },
    { label: 'Quit',  click: () => app.quit() },
  ]))
  tray.on('double-click', () => mainWindow?.show())
}
```

### Auto-Update (Phase 3+ with electron-updater)

```typescript
import { autoUpdater } from 'electron-updater'

autoUpdater.checkForUpdatesAndNotify()

autoUpdater.on('update-available',   () => mainWindow?.webContents.send('update:available'))
autoUpdater.on('update-downloaded',  () => mainWindow?.webContents.send('update:ready'))
// Renderer calls api.app.installUpdate() → autoUpdater.quitAndInstall()
```

---

## 27. React Page Component Patterns

Every page follows this exact structure. Copy the skeleton for every new page.

```typescript
// pages/{module}/{Module}Page.tsx
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
// Import domain-specific types from @pos/shared-types or local types

// ─── Types ────────────────────────────────────────────────────────────────────
interface DomainRecord {
  id: string
  // ... domain fields
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ModulePage() {
  const { branch } = useAuthStore()

  const [records, setRecords]   = useState<DomainRecord[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<DomainRecord | null>(null)

  // ─── Load data ──────────────────────────────────────────────────────────────
  const loadRecords = useCallback(async () => {
    if (!branch?.id) return
    setLoading(true)
    try {
      const data = await api.{domain}.getAll(branch.id) as DomainRecord[]
      setRecords(data ?? [])
    } catch {
      toast.error('Failed to load records')
    } finally {
      setLoading(false)
    }
  }, [branch?.id])

  useEffect(() => { loadRecords() }, [loadRecords])

  // ─── Actions ────────────────────────────────────────────────────────────────
  async function handleCreate(data: Partial<DomainRecord>) {
    try {
      await api.{domain}.create({ ...data, branchId: branch!.id })
      toast.success('Record created')
      await loadRecords()
    } catch {
      toast.error('Failed to create record')
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.{domain}.delete(id)
      toast.success('Record deleted')
      await loadRecords()
    } catch {
      toast.error('Failed to delete record')
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      Loading…
    </div>
  )

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{Module Title}</h1>
          <p className="text-sm text-muted-foreground">{records.length} records</p>
        </div>
        <button onClick={() => setSelected({} as DomainRecord)}
                className="btn-primary">
          + Add New
        </button>
      </div>

      {/* Content */}
      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3
                        text-muted-foreground">
          <p className="text-sm">No records found</p>
          <button onClick={() => setSelected({} as DomainRecord)}
                  className="btn-secondary text-sm">
            Create your first record
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {records.map(record => (
            <RecordCard
              key={record.id}
              record={record}
              onEdit={() => setSelected(record)}
              onDelete={() => handleDelete(record.id)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      {selected !== null && (
        <RecordDialog
          record={selected}
          onSave={handleCreate}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
```

### Loading / Empty / Error States — Standard Copy

```tsx
// Loading
<div className="flex items-center justify-center h-full text-muted-foreground text-sm">
  Loading…
</div>

// Empty state
<div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground">
  <Icon className="w-12 h-12 opacity-30" />
  <p className="font-medium">No {items} yet</p>
  <p className="text-xs">Add your first {item} to get started</p>
</div>

// Error banner (non-blocking, page still renders)
{error && (
  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
    {error}
  </div>
)}
```

---

## 28. Zustand Store Patterns

### Auth Store (auth.store.ts — present in every project)

```typescript
import { create } from 'zustand'
import type { Staff, Restaurant, Branch } from '@pos/shared-types'

interface AuthState {
  session:    Staff | null
  restaurant: Restaurant | null
  branch:     Branch | null
  isLoading:  boolean

  setLoading:  (v: boolean) => void
  login:       (staff: Staff) => void
  logout:      () => void
  setContext:  (restaurant: Restaurant, branch: Branch) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session:    null,
  restaurant: null,
  branch:     null,
  isLoading:  true,

  setLoading:  (isLoading) => set({ isLoading }),
  login:       (session)   => set({ session }),
  logout:      ()          => set({ session: null }),
  setContext:  (restaurant, branch) => set({ restaurant, branch }),
}))
```

### Cart/Transaction Store (cart.store.ts — present in POS-type apps)

```typescript
import { create } from 'zustand'

interface CartItem {
  id:        string
  name:      string
  qty:       number
  unitPrice: number
  total:     number
}

interface CartState {
  items:       CartItem[]
  discount:    number
  note:        string

  addItem:     (item: CartItem) => void
  removeItem:  (id: string) => void
  updateQty:   (id: string, qty: number) => void
  setDiscount: (pct: number) => void
  clear:       () => void

  // Computed
  subtotal:    () => number
  total:       () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items:    [],
  discount: 0,
  note:     '',

  addItem: (item) => set((s) => {
    const existing = s.items.find(i => i.id === item.id)
    if (existing) {
      return { items: s.items.map(i => i.id === item.id
        ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * i.unitPrice }
        : i
      )}
    }
    return { items: [...s.items, item] }
  }),

  removeItem:  (id)       => set(s => ({ items: s.items.filter(i => i.id !== id) })),
  updateQty:   (id, qty)  => set(s => ({
    items: qty <= 0
      ? s.items.filter(i => i.id !== id)
      : s.items.map(i => i.id === id
          ? { ...i, qty, total: qty * i.unitPrice }
          : i
        )
  })),
  setDiscount: (discount) => set({ discount }),
  clear:       ()         => set({ items: [], discount: 0, note: '' }),

  subtotal: () => get().items.reduce((sum, i) => sum + i.total, 0),
  total:    () => {
    const s = get()
    const subtotal = s.subtotal()
    return subtotal - (subtotal * s.discount / 100)
  },
}))
```

### Store Rules
- One store per **domain** — never one mega-store
- **No async in stores** — call `api.*` in component, then update store with result
- No `localStorage` persistence for operational data — SQLite is the source of truth
- Use `devtools` wrapper in dev for Zustand DevTools:
  ```typescript
  import { devtools } from 'zustand/middleware'
  export const useCartStore = create<CartState>()(devtools((set, get) => ({ ... }), { name: 'cart' }))
  ```

---

## 29. Security Patterns

### Electron Security Rules (non-negotiable)

```typescript
// webPreferences — ALWAYS these values:
{
  contextIsolation: true,   // Renderer cannot access Node.js APIs directly
  nodeIntegration:  false,  // Never expose Node.js to renderer
  sandbox:          false,  // false only because @libsql/client needs it
}

// Content Security Policy (set in BrowserWindow)
mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
      ]
    }
  })
})
```

### Input Validation (IPC layer)

```typescript
// In IPC handlers — validate all inputs from renderer
// Never trust renderer input. Treat it like a public API.
ipcMain.handle('orders:create', async (_e, data: unknown) => {
  // Validate with Zod before touching DB
  const schema = z.object({
    branchId:  z.string().min(1),
    orderType: z.enum(['dine_in', 'takeaway', 'delivery']),
    items:     z.array(z.object({
      menuItemId: z.string(),
      qty:        z.number().int().positive(),
    })).min(1),
  })
  const parsed = schema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Invalid data' }
  // proceed with parsed.data
})
```

### Cloud API Security

```typescript
// JWT middleware — all protected routes
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ success: false, error: { code: 'NO_TOKEN' } })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    next()
  } catch {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN' } })
  }
}

// Branch scope middleware — prevent cross-branch data access
export function branchMiddleware(req: Request, res: Response, next: NextFunction) {
  const branchId = req.params.branchId ?? req.body.branchId
  if (req.user.role !== 'super_admin' && req.user.branchId !== branchId) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } })
  }
  next()
}
```

### Password & PIN Hashing (use everywhere)

```typescript
// Server-side (cloud API) — use bcrypt
import bcrypt from 'bcryptjs'
const hash = await bcrypt.hash(password, 12)
const match = await bcrypt.compare(password, hash)

// Electron offline PIN — SHA-256 with per-user salt (stored in DB)
import { createHash, randomBytes } from 'crypto'
const salt = randomBytes(16).toString('hex')
const pinHash = createHash('sha256').update(salt + pin).digest('hex')
// Store: { staffId, pinHash, pinSalt }
// Verify: SHA-256(pinSalt + enteredPin) === stored pinHash
```

### What NEVER Goes in the Renderer

- DB connection strings
- JWT secrets or signing keys
- API keys (payment gateways, external services)
- File system paths (use IPC to request file operations)

---

## 30. Error Handling Flow

### Three-Layer Error Strategy

```
Layer 1: DB / IPC (main process)
   ↓  Returns { success: true, data } or { success: false, error: string }
   ↓  NEVER throws to renderer — always catches internally

Layer 2: Renderer (React component)
   ↓  Checks result.success; shows toast on failure
   ↓  NEVER shows raw error strings — always friendly messages

Layer 3: Global fallback (window.onerror)
   ↓  Catches any unhandled renderer error
   ↓  Logs to file; shows "Something went wrong — restart app" dialog
```

### IPC Handler — Standard Error Wrapper

```typescript
// Wrap every IPC handler body to prevent unhandled throws
ipcMain.handle('orders:create', async (_e, data) => {
  try {
    // ... business logic
    return { success: true, id: newId }
  } catch (err) {
    console.error('[orders:create]', err)
    // Log to file in production (use winston or electron-log)
    return { success: false, error: 'Failed to create order' }
  }
})
```

### Renderer — Standard Error Pattern

```typescript
// In component action handlers
async function handleSave() {
  try {
    const result = await api.orders.create(data)
    if (!result.success) {
      toast.error('Failed to save order')
      return
    }
    toast.success('Order saved')
    await reload()
  } catch {
    // Network or IPC crash — should be rare
    toast.error('Something went wrong — please try again')
  }
}
```

### Friendly Error Messages (never show technical details)

```
DB constraint violation  → "This record already exists"
Network timeout          → "Connection lost — please check your internet"
File permission denied   → "Cannot access that folder — try a different location"
Printer not found        → "Printer not connected — check USB cable or network"
Division by zero         → Should never reach UI — fix in calculation logic
JSON parse error         → "Data is corrupted — restore from backup"
```

---

## 31. Testing Setup

### Unit Tests — Vitest

```bash
npm install -D vitest @vitest/ui happy-dom
```

```typescript
// vitest.config.ts (in apps/desktop)
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.ts'],
    coverage: { reporter: ['text', 'lcov'] },
  },
})
```

```typescript
// Example: test utility functions
// src/lib/utils.test.ts
import { describe, it, expect } from 'vitest'
import { formatCurrency, calculateTax } from './utils'

describe('formatCurrency', () => {
  it('formats LKR correctly', () => {
    expect(formatCurrency(1234.5)).toBe('LKR 1,234.50')
  })
  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('LKR 0.00')
  })
})

describe('calculateTax', () => {
  it('calculates 8% tax on subtotal', () => {
    expect(calculateTax(1000, 8)).toBe(80)
  })
})
```

```typescript
// Example: test IPC service logic (pure functions, no Electron dependency)
// src/main/services/billing.service.test.ts
import { describe, it, expect } from 'vitest'
import { computeBillTotals } from './billing.service'

describe('computeBillTotals', () => {
  it('applies discount before tax', () => {
    const result = computeBillTotals({
      subtotal: 1000, discountPct: 10, taxRate: 8, serviceCharge: 0
    })
    expect(result.discountAmount).toBe(100)
    expect(result.taxAmount).toBe(72)          // 8% of 900
    expect(result.total).toBe(972)
  })
})
```

### E2E Tests — Playwright (Phase 2+)

```bash
npm install -D @playwright/test playwright-electron
```

```typescript
// e2e/login.spec.ts
import { test, expect } from '@playwright/test'
import { _electron as electron } from 'playwright'

test('staff can log in with valid PIN', async () => {
  const app = await electron.launch({ args: ['.'] })
  const page = await app.firstWindow()

  await page.locator('[data-testid="pin-input"]').fill('1234')
  await page.locator('[data-testid="login-btn"]').click()
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()

  await app.close()
})
```

### Test Coverage Targets

| Layer | Target | What to Test |
|---|---|---|
| Utility functions | 90%+ | All `lib/` helpers, formatters, calculators |
| IPC service logic | 70%+ | Pure calculation functions extracted from IPC handlers |
| React components | 50%+ | Critical flows: login, checkout, create/edit dialogs |
| E2E | Key flows only | Login, create order, complete payment, settings save |

### What NOT to Test
- Drizzle query builders — trust the library
- Electron internals (window creation, IPC plumbing)
- UI pixel positions and exact styling

---

## 32. CI/CD — GitHub Actions

```yaml
# .github/workflows/build.yml
name: Build Desktop App

on:
  push:
    branches: [main]
    tags:     ['v*.*.*']
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm test --workspace=apps/desktop

  build-windows:
    needs: test
    runs-on: windows-latest
    if: startsWith(github.ref, 'refs/tags/')   # only on version tags
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run build:win --workspace=apps/desktop
        env:
          CSC_LINK:     ${{ secrets.WIN_CODE_SIGN_CERT }}     # optional: code signing
          CSC_KEY_PASSWORD: ${{ secrets.WIN_CERT_PASSWORD }}
      - uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: apps/desktop/dist/*.exe
          retention-days: 30

  deploy-cloud-api:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build --workspace=apps/cloud-api
      # Deploy to Railway / Render / VPS via SSH
      - name: Deploy
        run: |
          # Railway: railway up --service cloud-api
          # Or SSH deploy: rsync + pm2 restart
```

### Release Flow

```
Developer pushes → git tag v1.2.0 → git push --tags
  → GitHub Actions builds Windows .exe
  → Uploads to GitHub Releases (or S3)
  → electron-updater picks it up on client restart
```

### PM2 Config (cloud API on VPS)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name:    '{project}-api',
    script:  'dist/index.js',
    env_production: {
      NODE_ENV: 'production',
      PORT:     3001,
    },
    instances: 2,          // cluster mode for load
    exec_mode: 'cluster',
    max_memory_restart: '512M',
  }]
}
```

---

## 33. Hardware Integration

### Thermal Receipt Printer (ESC/POS)

```bash
npm install escpos escpos-usb escpos-network
```

```typescript
// main/ipc/printer.ipc.ts
import escpos from 'escpos'
import USB    from 'escpos-usb'
import Network from 'escpos-network'

ipcMain.handle('printer:printReceipt', async (_e, receiptData: ReceiptData) => {
  try {
    // Try USB first, fall back to network printer
    const device = new USB()                          // USB HID auto-detect
    // OR: const device = new Network('192.168.1.100', 9100) // Network printer

    const printer = new escpos.Printer(device)

    await new Promise<void>((resolve, reject) => {
      device.open((err: Error) => {
        if (err) return reject(err)

        printer
          .font('A')
          .align('CT')
          .style('BOLD')
          .size(1, 1)
          .text(receiptData.restaurantName)
          .style('NORMAL')
          .size(0, 0)
          .text(receiptData.address)
          .text(receiptData.phone)
          .drawLine()
          .align('LT')
          .tableCustom([
            { text: 'Item',   align: 'LEFT',  width: 0.5 },
            { text: 'Qty',    align: 'CENTER',width: 0.2 },
            { text: 'Amount', align: 'RIGHT', width: 0.3 },
          ])
          .drawLine()

        for (const item of receiptData.items) {
          printer.tableCustom([
            { text: item.name,               align: 'LEFT',  width: 0.5 },
            { text: String(item.qty),        align: 'CENTER',width: 0.2 },
            { text: `${item.total.toFixed(2)}`, align: 'RIGHT', width: 0.3 },
          ])
        }

        printer
          .drawLine()
          .align('RT')
          .style('BOLD')
          .text(`TOTAL   ${receiptData.total.toFixed(2)}`)
          .style('NORMAL')
          .align('CT')
          .text(receiptData.thankYou)
          .cut()
          .close(resolve)
      })
    })

    return { success: true }
  } catch (err) {
    console.error('[printer:printReceipt]', err)
    return { success: false, error: 'Printer not connected' }
  }
})
```

### Cash Drawer Trigger

```typescript
// Cash drawer connected via printer's RJ11 port
// Trigger with ESC/POS pulse command
ipcMain.handle('printer:openDrawer', async () => {
  try {
    const device = new USB()
    const printer = new escpos.Printer(device)
    await new Promise<void>((resolve, reject) => {
      device.open((err: Error) => {
        if (err) return reject(err)
        // ESC/POS drawer pulse: pin 2, on-time 40ms, off-time 240ms
        printer.cashdraw(2).close(resolve)
      })
    })
    return { success: true }
  } catch {
    return { success: false, error: 'Cash drawer not connected' }
  }
})
```

### Barcode Scanner

USB barcode scanners work in **HID keyboard emulation mode** — no driver or library needed.
The scanner acts as a keyboard and types the barcode string followed by Enter.

```typescript
// In the React component, attach a keydown listener when scan mode is active
useEffect(() => {
  let buffer = ''
  let timer: ReturnType<typeof setTimeout>

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && buffer.length > 3) {
      onBarcodeScanned(buffer)  // trigger product lookup
      buffer = ''
    } else {
      buffer += e.key
      clearTimeout(timer)
      timer = setTimeout(() => { buffer = '' }, 100)  // reset if typing pauses
    }
  }

  window.addEventListener('keydown', handleKey)
  return () => window.removeEventListener('keydown', handleKey)
}, [onBarcodeScanned])
```

### Printer Detection IPC

```typescript
ipcMain.handle('printer:detect', async () => {
  try {
    const devices = USB.findPrinter()  // returns array of detected USB printers
    return { success: true, found: devices.length > 0, count: devices.length }
  } catch {
    return { success: true, found: false, count: 0 }
  }
})
```

---

## 34. Environment Variables

### Desktop App (Electron — no `.env` file at runtime)

Sensitive values are stored using Electron's `safeStorage` (OS-level encrypted):

```typescript
// main/ipc/app.ipc.ts — store/retrieve cloud API token
import { safeStorage } from 'electron'

ipcMain.handle('app:saveToken', async (_e, token: string) => {
  const encrypted = safeStorage.encryptString(token)
  // Save encrypted buffer to a file in app.getPath('userData')
  await fs.writeFile(join(app.getPath('userData'), 'auth.bin'), encrypted)
  return { success: true }
})

ipcMain.handle('app:loadToken', async () => {
  try {
    const encrypted = await fs.readFile(join(app.getPath('userData'), 'auth.bin'))
    return { success: true, token: safeStorage.decryptString(encrypted) }
  } catch {
    return { success: true, token: null }
  }
})
```

Non-sensitive config stored in `app.getPath('userData')/settings.json`:
```json
{
  "cloudApiUrl":    "https://api.yourproduct.com",
  "printerType":    "usb",
  "printerIp":      "",
  "autoBackupTime": "23:00",
  "theme":          "light"
}
```

### Cloud API (`.env` file — never commit to git)

```bash
# apps/cloud-api/.env
NODE_ENV=production
PORT=3001

# MongoDB
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/{dbname}?retryWrites=true&w=majority

# Auth
JWT_SECRET=<random-256-bit-hex>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=<different-random-256-bit-hex>
REFRESH_EXPIRES_IN=30d

# Vendor license keygen secret (keep offline/separate)
LICENSE_SECRET=<another-random-256-bit-hex>

# CORS
DASHBOARD_URL=https://dashboard.yourproduct.com
PWA_URL=https://order.yourproduct.com

# Optional: payment gateway, SMS, email
PAYHERE_MERCHANT_ID=
PAYHERE_SECRET=
```

### Environment Validation (fail fast — `config/env.ts`)

```typescript
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV:               z.enum(['development', 'production', 'test']),
  PORT:                   z.string().transform(Number),
  MONGO_URI:              z.string().url(),
  JWT_SECRET:             z.string().min(32),
  REFRESH_TOKEN_SECRET:   z.string().min(32),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)           // fail fast — don't start with broken config
}

export const env = parsed.data
```

---

## 35. Performance Targets + Optimization Rules

### Response Time Targets

| Operation | Target | Measurement Point |
|---|---|---|
| App startup → login screen | < 2 seconds | Cold start, SSD |
| PIN login → dashboard | < 500 ms | DB query + React render |
| Add item to cart | < 50 ms | Zustand state update |
| Complete payment | < 800 ms | DB write + receipt render |
| Load menu page | < 300 ms | DB query + full render |
| Load reports page | < 1 second | Aggregation query |
| Receipt print start | < 1.5 seconds | USB handshake + print |
| Page navigation | < 200 ms | React Router transition |

### React Optimization Rules

```typescript
// 1. Memoize expensive child components
const MenuItemCard = React.memo(({ item, onAdd }: Props) => { ... })

// 2. Stabilize callback references passed as props
const handleAdd = useCallback((id: string) => {
  useCartStore.getState().addItem(id)
}, [])  // empty deps — store is accessed via getState(), no closure

// 3. Avoid rerenders from selector over-subscription
// BAD:  const store = useAuthStore()             — rerenders on ANY store change
// GOOD: const branch = useAuthStore(s => s.branch) — rerenders only when branch changes

// 4. Heavy list rendering — virtualize at 100+ items
import { useVirtualizer } from '@tanstack/react-virtual'
// (add @tanstack/react-virtual for any list > 100 items)

// 5. Debounce search inputs
const [query, setQuery] = useState('')
const debouncedQuery = useDebounce(query, 300)
useEffect(() => { search(debouncedQuery) }, [debouncedQuery])
```

### SQLite Query Optimization Rules

```typescript
// 1. Always add branchId to WHERE — never scan full table
await db.select().from(orders)
  .where(and(
    eq(orders.branchId, branchId),      // ← always first
    eq(orders.status, 'active')
  ))

// 2. Paginate large result sets — never select all historical records
.limit(50).offset(page * 50)

// 3. Use indexes — add to schema on any frequently filtered column
export const orders = sqliteTable('orders', {
  ...columns
}, (t) => ({
  branchStatusIdx: index('orders_branch_status_idx').on(t.branchId, t.status),
  branchDateIdx:   index('orders_branch_date_idx').on(t.branchId, t.createdAt),
}))

// 4. Reports: run heavy aggregations in SQLite (not in JS)
// Use sql`` tagged template for complex GROUP BY queries
const dailySales = await db.select({
  date:  sql<string>`date(${bills.createdAt} / 1000, 'unixepoch')`,
  total: sql<number>`sum(${bills.total})`,
  count: sql<number>`count(*)`,
}).from(bills)
  .where(eq(bills.branchId, branchId))
  .groupBy(sql`date(${bills.createdAt} / 1000, 'unixepoch')`)
  .orderBy(desc(bills.createdAt))
```

### Bundle Size Rules

```
- Never import an entire library when you need one function
  BAD:  import * as dateFns from 'date-fns'
  GOOD: import { format, parseISO } from 'date-fns'

- Lazy-load heavy pages (reports, analytics)
  const ReportsPage = React.lazy(() => import('./pages/reports/ReportsPage'))

- Keep renderer bundle < 2 MB (check with: npx vite-bundle-visualizer)
```

### Day-Close / Session Management

```typescript
// At end of each business day — IPC handler
ipcMain.handle('app:dayClose', async (_e, branchId: string, staffId: string) => {
  const db = getDb()
  // 1. Calculate day totals
  const totals = await computeDayTotals(db, branchId)

  // 2. Insert day_summary record (immutable snapshot)
  await db.insert(schema.daySummaries).values({
    id: crypto.randomUUID().replace(/-/g, ''),
    branchId,
    closedByStaffId: staffId,
    date: new Date().toISOString().split('T')[0],
    totalSales:    totals.sales,
    totalOrders:   totals.orders,
    cashTotal:     totals.cash,
    cardTotal:     totals.card,
    closedAt:      Date.now(),
  })

  // 3. Auto-backup after close
  await createAutoBackup(branchId)

  // 4. Add to sync queue
  await db.insert(schema.syncQueue).values({
    entityType: 'day_summary',
    entityId:   totals.summaryId,
    operation:  'create',
    payload:    JSON.stringify(totals),
    branchId,
    deviceId:   getDeviceId(),
    createdAt:  Date.now(),
    status:     'pending',
  })

  return { success: true, totals }
})
