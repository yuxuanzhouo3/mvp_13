"use client"

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { TenantApplications } from "@/components/dashboard/tenant-applications"

export default function ApplicationsPage() {
  return (
    <DashboardLayout userType="landlord">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Tenant Applications</h1>
          <p className="text-muted-foreground">Review and manage rental applications</p>
        </div>
        <TenantApplications />
      </div>
    </DashboardLayout>
  )
}
