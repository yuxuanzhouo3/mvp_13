"use client"

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Home, Users, DollarSign, AlertCircle } from "lucide-react"
import { PropertyManagement } from "@/components/dashboard/property-management"
import { TenantApplications } from "@/components/dashboard/tenant-applications"
import { PaymentHistory } from "@/components/dashboard/payment-history"
import { MessageCenter } from "@/components/dashboard/message-center"

const stats = [
  {
    title: "Total Properties",
    value: "12",
    change: "+2 this month",
    icon: Home,
  },
  {
    title: "Active Tenants",
    value: "8",
    change: "+1 this month",
    icon: Users,
  },
  {
    title: "Monthly Revenue",
    value: "$24,800",
    change: "+12% from last month",
    icon: DollarSign,
  },
  {
    title: "Pending Issues",
    value: "3",
    change: "2 maintenance, 1 dispute",
    icon: AlertCircle,
  },
]

const recentActivity = [
  {
    id: 1,
    type: "application",
    message: "New application for Downtown Apartment",
    time: "2 hours ago",
    status: "pending",
  },
  {
    id: 2,
    type: "payment",
    message: "Rent payment received from John Doe",
    time: "1 day ago",
    status: "completed",
  },
  {
    id: 3,
    type: "maintenance",
    message: "Maintenance request for Capitol Hill Studio",
    time: "2 days ago",
    status: "in_progress",
  },
]

export default function LandlordDashboard() {
  return (
    <DashboardLayout userType="landlord">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Property Management</h1>
            <p className="text-muted-foreground">Manage your properties and tenants efficiently.</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Property
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                  </div>
                  <stat.icon className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates from your properties</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    <div>
                      <div className="font-medium">{activity.message}</div>
                      <div className="text-sm text-muted-foreground">{activity.time}</div>
                    </div>
                  </div>
                  <Badge variant={activity.status === "completed" ? "default" : "secondary"}>
                    {activity.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="properties" className="space-y-6">
          <TabsList>
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="tenants">Tenants</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
          </TabsList>

          <TabsContent value="properties">
            <PropertyManagement />
          </TabsContent>

          <TabsContent value="applications">
            <TenantApplications />
          </TabsContent>

          <TabsContent value="tenants" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Tenants</CardTitle>
                <CardDescription>Manage your tenant relationships</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  Tenant management interface would be implemented here
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <PaymentHistory userType="landlord" />
          </TabsContent>

          <TabsContent value="messages">
            <MessageCenter />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
