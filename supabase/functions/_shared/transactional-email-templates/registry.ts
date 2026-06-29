/// <reference types="npm:@types/react@18.3.1" />
import { template as serviceDueSoon } from './service-due-soon.tsx'
import { template as serviceOverdue } from './service-overdue.tsx'
import { template as woAssigned } from './wo-assigned.tsx'
import { template as maintenanceDigest } from './maintenance-digest.tsx'
import { template as inventoryLowStock } from './inventory-low-stock.tsx'

export interface TemplateEntry {
  component: any
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, unknown>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'service-due-soon': serviceDueSoon,
  'service-overdue': serviceOverdue,
  'wo-assigned': woAssigned,
  'maintenance-digest': maintenanceDigest,
  'inventory-low-stock': inventoryLowStock,
}
