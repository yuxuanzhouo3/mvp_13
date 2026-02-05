"use client"

import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { TenantApplications } from "@/components/dashboard/tenant-applications"

export default function ApplicationsPage() {
  const t = useTranslations('dashboard')
  return (
    <DashboardLayout userType="landlord">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('tenantApplications')}</h1>
          <p className="text-muted-foreground">{t('reviewAndManageApplications')}</p>
        </div>
        <TenantApplications />
      </div>
    </DashboardLayout>
  )
}
