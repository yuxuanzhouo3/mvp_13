"use client"

import { Suspense } from "react"
import { useTranslations } from 'next-intl'
import { useSearchParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { MessageCenter } from "@/components/dashboard/message-center"

function MessagesContent() {
  const searchParams = useSearchParams()
  const userId = searchParams.get('userId') || undefined

  return <MessageCenter initialUserId={userId} />
}

export default function MessagesPage() {
  const t = useTranslations('dashboard')
  return (
    <DashboardLayout userType="tenant">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('messages')}</h1>
          <p className="text-muted-foreground">{t('communicateWithLandlords') || "Communicate with landlords and property managers"}</p>
        </div>
        <Suspense fallback={<div className="h-[600px] flex items-center justify-center">Loading...</div>}>
          <MessagesContent />
        </Suspense>
      </div>
    </DashboardLayout>
  )
}
