import { registerAuthIPC }      from './auth.ipc'
import { registerProductsIPC }  from './products.ipc'
import { registerCategoriesIPC } from './categories.ipc'
import { registerInventoryIPC } from './inventory.ipc'
import { registerSalesIPC }     from './sales.ipc'
import { registerSettingsIPC }  from './settings.ipc'
import { registerLicenseIPC }   from './license.ipc'
import { registerCustomersIPC } from './customers.ipc'
import { registerReportsIPC }   from './reports.ipc'
import { registerReceiptIPC }   from './receipt.ipc'
import { registerSuppliersIPC } from './suppliers.ipc'
import { registerGRNIPC }       from './grn.ipc'
import { registerBackupIPC }    from './backup.ipc'

export function registerAllIPC(): void {
  registerLicenseIPC()
  registerBackupIPC()
  registerAuthIPC()
  registerProductsIPC()
  registerCategoriesIPC()
  registerInventoryIPC()
  registerSalesIPC()
  registerSettingsIPC()
  registerCustomersIPC()
  registerReportsIPC()
  registerReceiptIPC()
  registerSuppliersIPC()
  registerGRNIPC()
}
