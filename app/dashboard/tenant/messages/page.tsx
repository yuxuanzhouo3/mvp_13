"use client"

import { Suspense } from "react"
import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { MessageCenter } from "@/components/dashboard/message-center"

export default function MessagesPage() {
  const t = useTranslations('dashboard')
  return (
    <DashboardLayout userType="tenant">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('messages')}</h1>
          <p className="text-muted-foreground">{t('communicateWithLandlords') || "Communicate with landlords and property managers"}</p>
        </div>
        <Suspense fallback={<div />}>
          <MessageCenter />
        </Suspense>
      </div>
    </DashboardLayout>
  )
}
