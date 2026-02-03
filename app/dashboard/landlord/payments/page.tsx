"use client"

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { PaymentHistory } from "@/components/dashboard/payment-history"

export default function PaymentsPage() {
  return (
    <DashboardLayout userType="landlord">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Payments</h1>
          <p className="text-muted-foreground">View payment history and manage transactions</p>
        </div>
        <PaymentHistory userType="landlord" />
      </div>
    </DashboardLayout>
  )
}
