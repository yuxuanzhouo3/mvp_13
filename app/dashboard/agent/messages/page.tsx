"use client"

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { MessageCenter } from "@/components/dashboard/message-center"

export default function AgentMessagesPage() {
  return (
    <DashboardLayout userType="agent">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground">Communicate with landlords and tenants</p>
        </div>

        <MessageCenter />
      </div>
    </DashboardLayout>
  )
}
