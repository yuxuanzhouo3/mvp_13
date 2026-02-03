"use client"

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { MessageCenter } from "@/components/dashboard/message-center"

export default function MessagesPage() {
  return (
    <DashboardLayout userType="tenant">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground">Communicate with landlords and property managers</p>
        </div>
        <MessageCenter />
      </div>
    </DashboardLayout>
  )
}
