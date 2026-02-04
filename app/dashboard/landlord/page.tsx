"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Home, Users, DollarSign, AlertCircle, MessageSquare, Mail, Phone } from "lucide-react"
import { PropertyManagement } from "@/components/dashboard/property-management"
import { TenantApplications } from "@/components/dashboard/tenant-applications"
import { PaymentHistory } from "@/components/dashboard/payment-history"
import { MessageCenter } from "@/components/dashboard/message-center"
import { AIChat } from "@/components/dashboard/ai-chat"

export default function LandlordDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState({
    totalProperties: 0,
    activeTenants: 0,
    monthlyRevenue: 0,
    pendingIssues: 0,
  })
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      // Fetch properties
      const propertiesRes = await fetch("/api/properties", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (propertiesRes.ok) {
        const propertiesData = await propertiesRes.json()
        // 使用 pagination.total 获取真实的总数，而不是当前页的数量
        const totalProperties = propertiesData.pagination?.total || propertiesData.properties?.length || 0
        setStats(prev => ({ ...prev, totalProperties }))
      }

      // Fetch applications
      const applicationsRes = await fetch("/api/applications?userType=landlord", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (applicationsRes.ok) {
        const applicationsData = await applicationsRes.json()
        const applications = applicationsData.applications || []
        setStats(prev => ({ ...prev, activeTenants: applications.filter((a: any) => a.status === 'APPROVED').length }))
        
        // Set recent activity from applications
        const recent = applications.slice(0, 3).map((app: any, index: number) => ({
          id: app.id,
          type: "application",
          message: `New application for ${app.property?.title || 'Property'}`,
          time: index === 0 ? "2 hours ago" : index === 1 ? "1 day ago" : "2 days ago",
          status: app.status?.toLowerCase() || "pending",
        }))
        setRecentActivity(recent)
      }

      // Fetch tenants
      const tenantsRes = await fetch("/api/landlord/tenants", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json()
        setTenants(tenantsData.tenants || [])
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const statsCards = [
    {
      title: "Total Properties",
      value: stats.totalProperties.toString(),
      change: "",
      icon: Home,
    },
    {
      title: "Active Tenants",
      value: stats.activeTenants.toString(),
      change: "",
      icon: Users,
    },
    {
      title: "Monthly Revenue",
      value: `$${stats.monthlyRevenue.toLocaleString()}`,
      change: "",
      icon: DollarSign,
    },
    {
      title: "Pending Issues",
      value: stats.pendingIssues.toString(),
      change: "",
      icon: AlertCircle,
    },
  ]

  return (
    <DashboardLayout userType="landlord">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Property Management</h1>
            <p className="text-muted-foreground">Manage your properties and tenants efficiently.</p>
          </div>
          <Button onClick={() => router.push("/dashboard/landlord/add-property")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Property
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsCards.map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    {stat.change && <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>}
                  </div>
                  <stat.icon className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
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
        )}

        {/* Main Content Tabs */}
        <Tabs defaultValue="ai-search" className="space-y-6">
          <TabsList>
            <TabsTrigger value="ai-search">AI Smart Search</TabsTrigger>
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="tenants">Tenants</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
          </TabsList>

          <TabsContent value="ai-search" className="space-y-6">
            <AIChat userType="landlord" />
          </TabsContent>

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
                {tenants.length > 0 ? (
                  <div className="space-y-4">
                    {tenants.map((tenant) => (
                      <div key={tenant.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${tenant.name}`} />
                            <AvatarFallback>
                              {tenant.name?.split(' ').map((n: string) => n[0]).join('') || 'TN'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold">{tenant.name}</div>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Mail className="h-3 w-3 mr-1" />
                              {tenant.email}
                            </div>
                            {tenant.phone && (
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Phone className="h-3 w-3 mr-1" />
                                {tenant.phone}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            {tenant.propertyName && (
                              <div className="flex items-center text-sm">
                                <Home className="h-4 w-4 mr-1" />
                                {tenant.propertyName}
                              </div>
                            )}
                            <Badge variant={tenant.source === 'lease' ? 'default' : 'secondary'} className="mt-1">
                              {tenant.source === 'lease' ? 'Active Lease' : 'Approved'}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/dashboard/landlord/messages?userId=${tenant.id}`)}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Message
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No active tenants yet. Start accepting applications!
                  </div>
                )}
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
