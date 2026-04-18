import { contextBridge, ipcRenderer } from 'electron'

const invoke = (channel: string, ...args: unknown[]) =>
  ipcRenderer.invoke(channel, ...args)

const api = {
  license: {
    getStatus: ()               => invoke('license:getStatus'),
    activate:  (key: string)    => invoke('license:activate', key),
  },
  shell: {
    openExternal: (url: string) => invoke('shell:openExternal', url),
  },
  setup: {
    complete: (data: Record<string, unknown>) => invoke('setup:complete', data),
  },
  auth: {
    login:             (staffCode: string, pin: string)                              => invoke('auth:login', staffCode, pin),
    getSession:        ()                                                             => invoke('auth:getSession'),
    getContext:        (branchId: string)                                             => invoke('auth:getContext', branchId),
    getSuperAdminCode: ()                                                             => invoke('auth:getSuperAdminCode'),
    getRequestCode:    (staffCode: string)                                            => invoke('auth:getRequestCode', staffCode),
    resetSuperAdminPin:(staffCode: string, resetKey: string, newPin: string)          => invoke('auth:resetSuperAdminPin', staffCode, resetKey, newPin),
  },

  suppliers: {
    getAll:  (branchId: string)                              => invoke('suppliers:getAll', branchId),
    create:  (data: Record<string, unknown>)                 => invoke('suppliers:create', data),
    update:  (id: string, data: Record<string, unknown>)     => invoke('suppliers:update', id, data),
    delete:  (id: string)                                    => invoke('suppliers:delete', id),
  },
  grn: {
    getAll:  (branchId: string)                              => invoke('grn:getAll', branchId),
    getById: (id: string)                                    => invoke('grn:getById', id),
    create:  (data: Record<string, unknown>)                 => invoke('grn:create', data),
  },
  products: {
    getAll:       (branchId: string)                    => invoke('products:getAll', branchId),
    getById:      (id: string)                          => invoke('products:getById', id),
    getByBarcode: (barcode: string, branchId: string)   => invoke('products:getByBarcode', barcode, branchId),
    search:       (query: string, branchId: string)     => invoke('products:search', query, branchId),
    create:       (data: Record<string, unknown>)       => invoke('products:create', data),
    update:       (id: string, data: Record<string, unknown>) => invoke('products:update', id, data),
    delete:       (id: string)                          => invoke('products:delete', id),
    getExpiring:  (branchId: string, daysAhead?: number) => invoke('products:getExpiring', branchId, daysAhead),
    bulkImport:   (rows: Record<string, unknown>[], branchId: string) => invoke('products:bulkImport', rows, branchId),
  },
  categories: {
    getAll:  (branchId: string)                         => invoke('categories:getAll', branchId),
    create:  (data: Record<string, unknown>)            => invoke('categories:create', data),
    update:  (id: string, data: Record<string, unknown>) => invoke('categories:update', id, data),
    delete:  (id: string)                               => invoke('categories:delete', id),
  },
  inventory: {
    getAll:       (branchId: string)                              => invoke('inventory:getAll', branchId),
    getLowStock:  (branchId: string)                              => invoke('inventory:getLowStock', branchId),
    adjust:       (productId: string, qty: number, type: string, reason: string, staffId: string, branchId: string) =>
                  invoke('inventory:adjust', productId, qty, type, reason, staffId, branchId),
    getMovements: (productId: string, branchId: string)           => invoke('inventory:getMovements', productId, branchId),
  },
  sales: {
    create:            (data: Record<string, unknown>)            => invoke('sales:create', data),
    getById:           (id: string)                               => invoke('sales:getById', id),
    getHistory:        (branchId: string, filters: Record<string, unknown>) => invoke('sales:getHistory', branchId, filters),
    void:              (id: string, reason: string)               => invoke('sales:void', id, reason),
    createReturn:      (data: Record<string, unknown>)            => invoke('sales:createReturn', data),
    getSessionReport:  (sessionId: string)                        => invoke('sales:getSessionReport', sessionId),
    openSession:       (staffId: string, branchId: string, openingFloat: number) => invoke('sales:openSession', staffId, branchId, openingFloat),
    closeSession:      (sessionId: string, closingCash: number)   => invoke('sales:closeSession', sessionId, closingCash),
    getCurrentSession: (staffId: string, branchId: string)        => invoke('sales:getCurrentSession', staffId, branchId),
    getDailySummary:   (branchId: string, date?: number)          => invoke('sales:getDailySummary', branchId, date),
  },
  customers: {
    getAll:           (branchId: string)                              => invoke('customers:getAll', branchId),
    search:           (query: string, branchId: string)               => invoke('customers:search', query, branchId),
    getById:          (id: string)                                    => invoke('customers:getById', id),
    create:           (data: Record<string, unknown>)                 => invoke('customers:create', data),
    update:           (id: string, data: Record<string, unknown>)     => invoke('customers:update', id, data),
    delete:           (id: string)                                    => invoke('customers:delete', id),
    getCreditHistory: (customerId: string)                            => invoke('customers:getCreditHistory', customerId),
    topUp:            (data: Record<string, unknown>)                 => invoke('customers:topUp', data),
    settle:           (data: Record<string, unknown>)                 => invoke('customers:settle', data),
    adjustCredit:     (data: Record<string, unknown>)                 => invoke('customers:adjustCredit', data),
    getCreditSummary: (branchId: string)                              => invoke('customers:getCreditSummary', branchId),
  },
  reports: {
    getSalesSummary:      (branchId: string, from: number, to: number)                 => invoke('reports:getSalesSummary', branchId, from, to),
    getDailyBreakdown:    (branchId: string, from: number, to: number)                 => invoke('reports:getDailyBreakdown', branchId, from, to),
    getTopProducts:       (branchId: string, from: number, to: number, limit?: number) => invoke('reports:getTopProducts', branchId, from, to, limit),
    getPaymentBreakdown:  (branchId: string, from: number, to: number)                 => invoke('reports:getPaymentBreakdown', branchId, from, to),
    getProfitByCategory:  (branchId: string, from: number, to: number)                 => invoke('reports:getProfitByCategory', branchId, from, to),
  },
  backup: {
    create:  () => invoke('backup:create'),
    restore: () => invoke('backup:restore'),
  },
  receipt: {
    print: (saleId: string) => invoke('receipt:print', saleId),
  },
  settings: {
    getSupermarket:    ()                                         => invoke('settings:getSupermarket'),
    updateSupermarket: (id: string, data: Record<string, unknown>) => invoke('settings:updateSupermarket', id, data),
    uploadLogo:        (supermarketId: string)                    => invoke('settings:uploadLogo', supermarketId),
    removeLogo:        (supermarketId: string)                    => invoke('settings:removeLogo', supermarketId),
    getBranch:         (branchId: string)                         => invoke('settings:getBranch', branchId),
    updateBranch:      (id: string, data: Record<string, unknown>) => invoke('settings:updateBranch', id, data),
    getUnits:          (branchId: string)                         => invoke('settings:getUnits', branchId),
    createUnit:        (data: Record<string, unknown>)            => invoke('settings:createUnit', data),
    updateUnit:        (id: string, data: Record<string, unknown>) => invoke('settings:updateUnit', id, data),
    getStaff:          (branchId: string)                         => invoke('settings:getStaff', branchId),
    createStaff:       (data: Record<string, unknown>)            => invoke('settings:createStaff', data),
    updateStaff:       (id: string, data: Record<string, unknown>) => invoke('settings:updateStaff', id, data),
    resetStaffPin:     (id: string, newPin: string)               => invoke('settings:resetStaffPin', id, newPin),
  },
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
