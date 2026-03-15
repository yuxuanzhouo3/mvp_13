"use client"

import { useState, useEffect, useCallback } from "react"
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
  const [activeTab, setActiveTab] = useState("ai-search")

  const toRelativeTime = (dateValue?: any) => {
    const date = new Date(dateValue || 0)
    if (Number.isNaN(date.getTime())) return ""
    const diffMs = Date.now() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHr = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHr / 24)
    const isChina = process.env.NEXT_PUBLIC_APP_REGION === 'china'
    if (isChina) {
      if (diffMin < 1) return '刚刚'
      if (diffMin < 60) return `${diffMin} 分钟前`
      if (diffHr < 24) return `${diffHr} 小时前`
      return `${diffDay} 天前`
    }
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin} minutes ago`
    if (diffHr < 24) return `${diffHr} hours ago`
    return `${diffDay} days ago`
  }

  const safeParseDistribution = (value: any) => {
    if (!value) return null
    if (typeof value === 'object') return value
    if (typeof value === 'string') {
      try {
        return JSON.parse(value)
      } catch {
        return null
      }
    }
    return null
  }

  const fetchTenantsList = useCallback(async (providedToken?: string) => {
    const token = providedToken || localStorage.getItem("auth-token")
    if (!token) return []
    try {
      const response = await fetch("/api/landlord/tenants", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        const list = data.tenants || []
        setTenants(list)
        return list
      }
    } catch {}
    return []
  }, [])

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

      const refreshProfile = async (fallbackUser?: any) => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 6000)
        try {
          const profileRes = await fetch("/api/auth/profile", {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          })
          if (profileRes.status === 401 || profileRes.status === 403) {
            handleUnauthorized()
            return null
          }
          if (profileRes.ok) {
            const data = await profileRes.json().catch(() => ({}))
            if (data.user) {
              localStorage.setItem("user", JSON.stringify(data.user))
              return data.user
            }
          }
          return fallbackUser || null
        } catch {
          return fallbackUser || null
        } finally {
          clearTimeout(timeoutId)
        }
      }
      const refreshedUser = await refreshProfile(user)
      user = refreshedUser || user

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

  useEffect(() => {
    if (activeTab === "tenants" && !loading && tenants.length === 0) {
      fetchTenantsList()
    }
  }, [activeTab, loading, tenants.length, fetchTenantsList])

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
      const fetchWithTimeout = async (url: string, timeoutMs: number) => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
        try {
          return await fetch(url, { headers, signal: controller.signal })
        } finally {
          clearTimeout(timeoutId)
        }
      }
      const statsRes = await fetchWithTimeout("/api/landlord/dashboard-stats", 8000)
      if (statsRes.status === 401 || statsRes.status === 403) {
        handleUnauthorized()
        return
      }

      let serverStats: any = null
      if (statsRes.ok) {
        const statsData = await statsRes.json().catch(() => ({}))
        if (statsData?.stats) {
          serverStats = statsData.stats
        }
      }

      const [applicationsResult, tenantsResult, propertiesResult, paymentsResult, notificationsResult] = await Promise.allSettled([
        fetchWithTimeout("/api/applications?userType=landlord", 8000),
        fetchWithTimeout("/api/landlord/tenants", 8000),
        fetchWithTimeout("/api/properties", 8000),
        fetchWithTimeout("/api/payments", 8000),
        fetchWithTimeout("/api/notifications", 8000),
      ])

      let propertiesCount = 0
      let approvedApplicationsCount = 0
      let monthlyRevenueFallback = 0
      let pendingIssuesFallback = 0
      let notifications: any[] = []
      let applications: any[] = []
      if (applicationsResult.status === "fulfilled" && applicationsResult.value.ok) {
        const applicationsData = await applicationsResult.value.json().catch(() => ({}))
        applications = applicationsData.applications || []
        approvedApplicationsCount = applications.filter((a: any) => a.status === 'APPROVED').length
      }

      let tenantsCount = 0
      if (tenantsResult.status === "fulfilled" && tenantsResult.value.ok) {
        const tenantsData = await tenantsResult.value.json().catch(() => ({}))
        const tenantsList = tenantsData.tenants || []
        tenantsCount = tenantsList.length
        setTenants(tenantsList)
      }

      if (propertiesResult.status === "fulfilled" && propertiesResult.value.ok) {
        const propertiesData = await propertiesResult.value.json().catch(() => ({}))
        const properties = propertiesData.properties || []
        propertiesCount = properties.length
      }

      if (paymentsResult.status === "fulfilled" && paymentsResult.value.ok) {
        const paymentsData = await paymentsResult.value.json().catch(() => ({}))
        const payments = paymentsData.payments || []
        const now = new Date()
        payments.forEach((payment: any) => {
          const status = String(payment.status || '').toUpperCase()
          if (status !== 'PAID' && status !== 'COMPLETED') return
          const date = new Date(payment.paidAt || payment.createdAt || payment.updatedAt || 0)
          if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return
          const dist = safeParseDistribution(payment.distribution)
          const amount = payment.type === 'RENT' && dist ? dist.landlordNet : (payment.amount ?? payment.total ?? 0)
          monthlyRevenueFallback += Number(amount) || 0
        })
      }

      if (notificationsResult.status === "fulfilled" && notificationsResult.value.ok) {
        const notificationsData = await notificationsResult.value.json().catch(() => ({}))
        notifications = notificationsData.notifications || []
        pendingIssuesFallback = notifications.filter((n: any) => n.isRead === false || n.is_read === false).length
      }

      const activityFromApplications = (applications || []).map((app: any) => {
        const rawStatus = app.status?.toLowerCase() || "pending"
        const timeValue = app.createdAt || app.appliedDate || app.updatedAt
        return {
          id: app.id,
          type: "application",
          message: t('newApplicationForProperty', { title: app.property?.title || t('property') }),
          time: toRelativeTime(timeValue),
          status: rawStatus,
          displayStatus: t(rawStatus) || rawStatus,
          timestamp: new Date(timeValue || 0).getTime(),
        }
      })

      const activityFromNotifications = (notifications || []).map((notif: any) => {
        const timeValue = notif.createdAt || notif.created_at
        const isRead = notif.isRead ?? notif.is_read
        const status = isRead ? "completed" : "pending"
        return {
          id: notif.id,
          type: "notification",
          message: notif.title || notif.message || "",
          time: toRelativeTime(timeValue),
          status,
          displayStatus: isRead ? t('completed') : t('unread'),
          timestamp: new Date(timeValue || 0).getTime(),
        }
      })

      const mergedActivity = [...activityFromApplications, ...activityFromNotifications]
        .filter((item) => item.message)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 3)
      setRecentActivity(mergedActivity)

      const computedStats = {
        totalProperties: Number(serverStats?.totalProperties || propertiesCount || 0),
        activeTenants: Number(serverStats?.activeTenants || tenantsCount || approvedApplicationsCount),
        monthlyRevenue: Number(serverStats?.monthlyRevenue || monthlyRevenueFallback || 0),
        pendingIssues: Number(serverStats?.pendingIssues || pendingIssuesFallback || 0),
      }

      setStats(computedStats)
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
    },
    {
      title: t('activeTenants'),
      value: stats.activeTenants.toString(),
      icon: Users,
    },
    {
      title: t('monthlyRevenue'),
      value: `${getCurrencySymbol()}${stats.monthlyRevenue.toLocaleString()}`,
      icon: DollarSign,
    },
    {
      title: t('pendingIssues'),
      value: stats.pendingIssues.toString(),
      icon: AlertCircle,
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

        <Card>
          <CardHeader>
            <CardTitle>{t('recentActivity')}</CardTitle>
            <CardDescription>{t('latestUpdates')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
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
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">{t('noRecentActivity')}</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="ai-search">{t('aiSmartSearch')}</TabsTrigger>
            <TabsTrigger value="properties">{t('properties')}</TabsTrigger>
            <TabsTrigger value="applications">{t('applications')}</TabsTrigger>
            <TabsTrigger value="tenants">{t('tenants')}</TabsTrigger>
            <TabsTrigger value="payments">{t('payments')}</TabsTrigger>
            <TabsTrigger value="messages">{t('messages')}</TabsTrigger>
          </TabsList>

          <TabsContent value="ai-search" className="space-y-6">
            {activeTab === "ai-search" && <AIChat userType="landlord" />}
          </TabsContent>

          <TabsContent value="properties">
            {activeTab === "properties" && <PropertyManagement />}
          </TabsContent>

          <TabsContent value="applications">
            {activeTab === "applications" && <TenantApplications />}
          </TabsContent>

          <TabsContent value="tenants" className="space-y-6">
            {activeTab === "tenants" && (
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
            )}
          </TabsContent>

          <TabsContent value="payments">
            {activeTab === "payments" && <PaymentHistory userType="landlord" />}
          </TabsContent>

          <TabsContent value="messages">
            {activeTab === "messages" && <MessageCenter />}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
