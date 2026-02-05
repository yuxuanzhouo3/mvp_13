"use client"

import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { PaymentHistory } from "@/components/dashboard/payment-history"

export default function PaymentsPage() {
  const t = useTranslations('dashboard')
  const tPayment = useTranslations('payment')
  return (
    <DashboardLayout userType="landlord">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{tPayment('title')}</h1>
          <p className="text-muted-foreground">{t('viewPaymentHistory') || "View payment history and manage transactions"}</p>
        </div>
        <PaymentHistory userType="landlord" />
      </div>
    </DashboardLayout>
  )
}
