"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Home, Users, DollarSign, AlertCircle, MessageSquare, Mail, Phone } from "lucide-react"
import { getCurrencySymbol } from "@/lib/utils"
import { PropertyManagement } from "@/components/dashboard/property-management"
import { TenantApplications } from "@/components/dashboard/tenant-applications"
import { PaymentHistory } from "@/components/dashboard/payment-history"
import { MessageCenter } from "@/components/dashboard/message-center"
import { AIChat } from "@/components/dashboard/ai-chat"

export default function LandlordDashboard() {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
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
    const bootstrap = async () => {
      const token = localStorage.getItem("auth-token")
      if (!token) {
        router.replace("/auth/login")
        return
      }

      let user: any = null
      const userStr = localStorage.getItem("user")
      if (userStr) {
        try {
          user = JSON.parse(userStr)
        } catch (e) {
          localStorage.removeItem("user")
        }
      }

      if (!user) {
        const profileRes = await fetch("/api/auth/profile", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (profileRes.status === 401 || profileRes.status === 403) {
          handleUnauthorized()
          return
        }
        if (profileRes.ok) {
          const data = await profileRes.json().catch(() => ({}))
          if (data.user) {
            localStorage.setItem("user", JSON.stringify(data.user))
            user = data.user
          }
        }
      }

      if (user) {
        setCurrentUser(user)
        const userType = String(user.userType || "").toUpperCase()
        if (userType !== "LANDLORD") {
          if (userType === "TENANT") {
            router.push("/dashboard/tenant")
          } else if (userType === "AGENT") {
            router.push("/dashboard/agent")
          } else {
            router.push("/auth/login")
          }
          return
        }
      }

      await fetchDashboardData(token, user)
    }

    bootstrap()
  }, [])

  const handleUnauthorized = () => {
    localStorage.removeItem("auth-token")
    localStorage.removeItem("user")
    router.replace("/auth/login")
  }

  const fetchDashboardData = async (token: string, user?: any) => {
    try {
      if (!token) {
        handleUnauthorized()
        return
      }

      const headers = { Authorization: `Bearer ${token}` }
      const [propertiesRes, applicationsRes, tenantsRes, paymentsRes, notificationsRes] = await Promise.all([
        fetch("/api/properties", { headers }),
        fetch("/api/applications?userType=landlord", { headers }),
        fetch("/api/landlord/tenants", { headers }),
        fetch("/api/payments", { headers }),
        fetch("/api/notifications?unreadOnly=true", { headers }),
      ])

      const unauthorized = [propertiesRes, applicationsRes, tenantsRes, paymentsRes, notificationsRes].some(
        (res) => res.status === 401 || res.status === 403
      )
      if (unauthorized) {
        handleUnauthorized()
        return
      }

      let propertiesCount = 0
      if (propertiesRes.ok) {
        const propertiesData = await propertiesRes.json().catch(() => ({}))
        const totalFromPagination = propertiesData.pagination?.total ?? propertiesData.total
        propertiesCount = totalFromPagination ?? propertiesData.properties?.length ?? 0
      }

      if (propertiesCount === 0 && user?.id) {
        const fallbackRes = await fetch(`/api/properties?landlordId=${user.id}`, { headers })
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json().catch(() => ({}))
          const totalFromPagination = fallbackData.pagination?.total ?? fallbackData.total
          propertiesCount = totalFromPagination ?? fallbackData.properties?.length ?? 0
        }
      }

      let approvedApplicationsCount = 0
      if (applicationsRes.ok) {
        const applicationsData = await applicationsRes.json().catch(() => ({}))
        const applications = applicationsData.applications || []
        approvedApplicationsCount = applications.filter((a: any) => a.status === 'APPROVED').length
        
        // Set recent activity from applications
        const isChina = process.env.NEXT_PUBLIC_APP_REGION === 'china'
        const recent = applications.slice(0, 3).map((app: any, index: number) => {
          const rawStatus = app.status?.toLowerCase() || "pending"
          return {
            id: app.id,
            type: "application",
            message: t('newApplicationForProperty', { title: app.property?.title || t('property') }),
            time: index === 0 
              ? (isChina ? "2小时前" : "2 hours ago") 
              : index === 1 
                ? (isChina ? "1天前" : "1 day ago") 
                : (isChina ? "2天前" : "2 days ago"),
            status: rawStatus,
            displayStatus: t(rawStatus) || rawStatus,
          }
        })
        setRecentActivity(recent)
      }

      let tenantsCount = 0
      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json().catch(() => ({}))
        const tenantsList = tenantsData.tenants || []
        tenantsCount = tenantsList.length
        setTenants(tenantsList)
      }

      let monthlyRevenue = 0
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json().catch(() => ({}))
        const payments = paymentsData.payments || []
        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()
        monthlyRevenue = payments
          .filter((p: any) => {
            const status = String(p.status || '').toUpperCase()
            if (status !== 'COMPLETED' && status !== 'PAID') return false
            const createdAt = new Date(p.createdAt || p.updatedAt || p.paidAt || p.created_at || p.paid_at || 0)
            return createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear
          })
          .reduce((sum: number, p: any) => {
            const dist = p.distribution || {}
            const amount = Number(dist.landlordNet ?? p.amount ?? 0)
            return sum + (isNaN(amount) ? 0 : amount)
          }, 0)
      }

      let pendingIssues = 0
      if (notificationsRes.ok) {
        const notificationsData = await notificationsRes.json().catch(() => ({}))
        pendingIssues = (notificationsData.notifications || []).length
      }

      setStats({
        totalProperties: propertiesCount,
        activeTenants: tenantsCount || approvedApplicationsCount,
        monthlyRevenue,
        pendingIssues,
      })
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const statsConfig = [
    {
      title: t('totalProperties'),
      value: stats.totalProperties.toString(),
      icon: Home,
      trend: "+1", // TODO: Real trend
    },
    {
      title: t('activeTenants'),
      value: stats.activeTenants.toString(),
      icon: Users,
      trend: "+2",
    },
    {
      title: t('monthlyRevenue'),
      value: `${getCurrencySymbol()}${stats.monthlyRevenue.toLocaleString()}`,
      icon: DollarSign,
      trend: "+12%",
    },
    {
      title: t('pendingIssues'),
      value: stats.pendingIssues.toString(),
      icon: AlertCircle,
      trend: "-2",
    },
  ]

  return (
    <DashboardLayout userType="landlord">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t('propertyManagement') || "Property Management"}</h1>
            <p className="text-muted-foreground">{t('manageEfficiently') || "Manage your properties and tenants efficiently."}</p>
          </div>
          <Button onClick={() => router.push("/dashboard/landlord/add-property")}>
            <Plus className="mr-2 h-4 w-4" />
            {t('addProperty') || "Add Property"}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statsConfig.map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    {stat.trend && <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>}
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
              <CardTitle>{t('recentActivity')}</CardTitle>
              <CardDescription>{t('latestUpdates')}</CardDescription>
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
                      {activity.displayStatus || activity.status.replace("_", " ")}
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
            <TabsTrigger value="ai-search">{t('aiSmartSearch')}</TabsTrigger>
            <TabsTrigger value="properties">{t('properties')}</TabsTrigger>
            <TabsTrigger value="applications">{t('applications')}</TabsTrigger>
            <TabsTrigger value="tenants">{t('tenants')}</TabsTrigger>
            <TabsTrigger value="payments">{t('payments')}</TabsTrigger>
            <TabsTrigger value="messages">{t('messages')}</TabsTrigger>
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
                <CardTitle>{t('currentTenants')}</CardTitle>
                <CardDescription>{t('manageTenantRelationships')}</CardDescription>
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
                              {tenant.source === 'lease' ? t('activeLease') : t('approved')}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/dashboard/landlord/messages?userId=${tenant.id}`)}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            {t('sendMessage')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('noTenantsYet') || "No active tenants yet. Start accepting applications!"}
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
