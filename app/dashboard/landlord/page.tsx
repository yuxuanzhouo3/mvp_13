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
  const STATS_CACHE_KEY = "landlord-dashboard-stats"
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
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("ai-search")

  const cleanText = useCallback((text: string) => {
    return text?.replace(/^(property\.|dashboard\.|common\.|application\.|payment\.)/i, '') || text
  }, [])

  const handleMessageClick = (userId: string) => {
    setSelectedContactId(userId)
    setActiveTab("messages")
  }

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
  const parseTokenHints = (token: string) => {
    try {
      const payloadBase64 = token.split(".")[1]
      if (!payloadBase64) return { userId: "", email: "" }
      const normalized = payloadBase64.replace(/-/g, "+").replace(/_/g, "/")
      const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
      const decoded = JSON.parse(atob(padded))
      const userId = decoded?.userId || decoded?.sub || decoded?.id || ""
      const email = decoded?.email || decoded?.userEmail || ""
      return { userId: String(userId || ""), email: String(email || "") }
    } catch {
      return { userId: "", email: "" }
    }
  }

  const fetchTenantsList = useCallback(async (providedToken?: string) => {
    const token = providedToken || localStorage.getItem("auth-token")
    if (!token) return []
    try {
      const headerBag: Record<string, string> = { Authorization: `Bearer ${token}` }
      let localUser: any = currentUser
      if (!localUser) {
        const userStr = localStorage.getItem("user")
        if (userStr) {
          try {
            localUser = JSON.parse(userStr)
          } catch {
            localStorage.removeItem("user")
          }
        }
      }
      const tokenHints = parseTokenHints(token)
      if (localUser?.id) headerBag["x-user-id"] = String(localUser.id)
      if (localUser?.email) headerBag["x-user-email"] = String(localUser.email)
      if (!headerBag["x-user-id"] && tokenHints.userId) headerBag["x-user-id"] = tokenHints.userId
      if (!headerBag["x-user-email"] && tokenHints.email) headerBag["x-user-email"] = tokenHints.email
      const response = await fetch("/api/landlord/tenants", {
        headers: headerBag,
      })
      if (response.ok) {
        const data = await response.json().catch(() => ({}))
        const list = data.tenants || []
        setTenants(list)
        return list
      }
    } catch {}
    return []
  }, [currentUser])

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
        const timeoutId = setTimeout(() => controller.abort(), 12000)
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
      if (!user) {
        const hints = parseTokenHints(token)
        if (hints.userId || hints.email) {
          user = {
            id: hints.userId,
            email: hints.email,
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
      let hasCachedNonZeroStats = false
      const cachedStatsRaw = localStorage.getItem(STATS_CACHE_KEY)
      if (cachedStatsRaw) {
        try {
          const cached = JSON.parse(cachedStatsRaw)
          const cachedStats = {
            totalProperties: Number(cached?.totalProperties ?? 0),
            activeTenants: Number(cached?.activeTenants ?? 0),
            monthlyRevenue: Number(cached?.monthlyRevenue ?? 0),
            pendingIssues: Number(cached?.pendingIssues ?? 0),
          }
          if (cachedStats.totalProperties || cachedStats.activeTenants || cachedStats.monthlyRevenue || cachedStats.pendingIssues) {
            hasCachedNonZeroStats = true
            setStats(cachedStats)
          }
        } catch {}
      }

      const headerBag: Record<string, string> = { Authorization: `Bearer ${token}` }
      let effectiveUser = user || currentUser
      if (!effectiveUser) {
        const userStr = localStorage.getItem("user")
        if (userStr) {
          try {
            effectiveUser = JSON.parse(userStr)
          } catch {
            localStorage.removeItem("user")
          }
        }
      }
      if (!effectiveUser?.id || !effectiveUser?.email) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 12000)
        try {
          const profileRes = await fetch("/api/auth/profile", {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          })
          if (profileRes.ok) {
            const profileData = await profileRes.json().catch(() => ({}))
            if (profileData?.user) {
              effectiveUser = profileData.user
              setCurrentUser(profileData.user)
              localStorage.setItem("user", JSON.stringify(profileData.user))
            }
          }
        } catch {} finally {
          clearTimeout(timeoutId)
        }
      }
      const tokenHints = parseTokenHints(token)
      if (effectiveUser?.id) {
        headerBag["x-user-id"] = String(effectiveUser.id)
      }
      if (effectiveUser?.email) {
        headerBag["x-user-email"] = String(effectiveUser.email)
      }
      if (!headerBag["x-user-id"] && tokenHints.userId) {
        headerBag["x-user-id"] = tokenHints.userId
      }
      if (!headerBag["x-user-email"] && tokenHints.email) {
        headerBag["x-user-email"] = tokenHints.email
      }
      const REQUEST_TIMEOUT_MS = 30000
      const LONG_TIMEOUT_MS = 45000
      const fetchWithTimeout = async (url: string, timeoutMs: number) => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
        try {
          return await fetch(url, {
            headers: headerBag,
            signal: controller.signal,
            credentials: "include",
            cache: "no-store",
          })
        } catch (error: any) {
          if (error?.name === "AbortError") {
            return null
          }
          throw error
        } finally {
          clearTimeout(timeoutId)
        }
      }
      const fetchWithFallback = async (urls: string[], timeoutMs: number) => {
        let firstNon404: Response | null = null
        for (const url of urls) {
          const response = await fetchWithTimeout(url, timeoutMs)
          if (!response) continue
          if (response.status === 404) continue
          if (response.ok) return response
          if (response.status === 401 || response.status === 403) continue
          if (!firstNon404) firstNon404 = response
        }
        return firstNon404
      }

      // 只使用实际存在的统计接口，避免无意义的 404 日志
      const statsCandidates = [
        "/api/landlord/dashboard-stats",
      ]
      const statsRes = await fetchWithFallback(statsCandidates, REQUEST_TIMEOUT_MS)

      let serverStats: any = null
      let normalizedServerStats = {
        totalProperties: 0,
        activeTenants: 0,
        monthlyRevenue: 0,
        pendingIssues: 0,
      }
      if (statsRes?.ok) {
        const statsData = await statsRes.json().catch(() => ({}))
        serverStats =
          statsData?.stats ||
          statsData?.data?.stats ||
          statsData?.data ||
          statsData
      }
      if (serverStats) {
        normalizedServerStats = {
          totalProperties:
          Number(serverStats?.totalProperties ?? serverStats?.total_properties ?? serverStats?.propertiesCount ?? 0)
          ,
          activeTenants:
          Number(serverStats?.activeTenants ?? serverStats?.active_tenants ?? serverStats?.tenantsCount ?? 0)
          ,
          monthlyRevenue:
          Number(serverStats?.monthlyRevenue ?? serverStats?.monthly_revenue ?? serverStats?.revenue ?? 0)
          ,
          pendingIssues:
          Number(serverStats?.pendingIssues ?? serverStats?.pending_issues ?? serverStats?.issues ?? 0)
        }
      }

      const [
        applicationsResult,
        tenantsResult,
        propertiesResult,
        paymentsResult,
        notificationsResult,
      ] = await Promise.allSettled([
        fetchWithFallback(
          ["/api/applications?userType=landlord"],
          REQUEST_TIMEOUT_MS
        ),
        fetchWithFallback(
          ["/api/landlord/tenants"],
          REQUEST_TIMEOUT_MS
        ),
        fetchWithFallback(
          ["/api/properties"],
          REQUEST_TIMEOUT_MS
        ),
        fetchWithFallback(
          ["/api/payments"],
          REQUEST_TIMEOUT_MS
        ),
        fetchWithFallback(
          ["/api/notifications"],
          REQUEST_TIMEOUT_MS
        ),
      ])

      let propertiesCount = 0
      let approvedApplicationsCount = 0
      let monthlyRevenueFallback = 0
      let pendingIssuesFallback = 0
      let notifications: any[] = []
      let applications: any[] = []
      if (applicationsResult.status === "fulfilled" && applicationsResult.value?.ok) {
        const applicationsData = await applicationsResult.value.json().catch(() => ({}))
        applications = applicationsData.applications || applicationsData.data?.applications || applicationsData.data || []
        approvedApplicationsCount = applications.filter((a: any) => String(a?.status || "").toUpperCase() === 'APPROVED').length
      }

      let tenantsCount = 0
      if (tenantsResult.status === "fulfilled" && tenantsResult.value?.ok) {
        const tenantsData = await tenantsResult.value.json().catch(() => ({}))
        const tenantsList = tenantsData.tenants || tenantsData.data?.tenants || tenantsData.data || []
        tenantsCount = tenantsList.length
        setTenants(tenantsList)
      }

      if (propertiesResult.status === "fulfilled" && propertiesResult.value?.ok) {
        const propertiesData = await propertiesResult.value.json().catch(() => ({}))
        const properties = propertiesData.properties || propertiesData.data?.properties || propertiesData.data || []
        const totalFromPagination = Number(
          propertiesData?.pagination?.total ??
          propertiesData?.data?.pagination?.total ??
          propertiesData?.total ??
          0
        )
        propertiesCount = Math.max(properties.length, totalFromPagination)
      }

      if (paymentsResult.status === "fulfilled" && paymentsResult.value?.ok) {
        const paymentsData = await paymentsResult.value.json().catch(() => ({}))
        const payments = paymentsData.payments || paymentsData.data?.payments || paymentsData.data || []
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

      if (notificationsResult.status === "fulfilled" && notificationsResult.value?.ok) {
        const notificationsData = await notificationsResult.value.json().catch(() => ({}))
        notifications = notificationsData.notifications || notificationsData.data?.notifications || notificationsData.data || []
        pendingIssuesFallback = notifications.filter((n: any) => n.isRead === false || n.is_read === false).length
      }

      const activityFromApplications = (applications || []).map((app: any) => {
        const rawStatus = app.status?.toLowerCase() || "pending"
        const timeValue = app.createdAt || app.appliedDate || app.updatedAt
        return {
          id: app.id,
          type: "application",
          message: t('newApplicationForProperty', { title: cleanText(app.property?.title || t('property')) }),
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

      // Merge server stats with local fallback calculations
      setStats(prev => ({
        totalProperties: Math.max(prev.totalProperties, normalizedServerStats.totalProperties, propertiesCount),
        activeTenants: Math.max(prev.activeTenants, normalizedServerStats.activeTenants, tenantsCount),
        monthlyRevenue: Math.max(prev.monthlyRevenue, normalizedServerStats.monthlyRevenue, monthlyRevenueFallback),
        pendingIssues: Math.max(prev.pendingIssues, normalizedServerStats.pendingIssues, pendingIssuesFallback),
      }))

      // Cache non-zero stats
      const finalStats = {
        totalProperties: Math.max(normalizedServerStats.totalProperties, propertiesCount),
        activeTenants: Math.max(normalizedServerStats.activeTenants, tenantsCount),
        monthlyRevenue: Math.max(normalizedServerStats.monthlyRevenue, monthlyRevenueFallback),
        pendingIssues: Math.max(normalizedServerStats.pendingIssues, pendingIssuesFallback),
      }

      if (finalStats.totalProperties || finalStats.activeTenants || finalStats.monthlyRevenue || finalStats.pendingIssues) {
        localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(finalStats))
      }

    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const statsConfig = [
    {
      title: cleanText(t('totalProperties')),
      value: stats.totalProperties.toString(),
      icon: Home,
    },
    {
      title: cleanText(t('activeTenants')),
      value: stats.activeTenants.toString(),
      icon: Users,
    },
    {
      title: cleanText(t('monthlyRevenue')),
      value: `${getCurrencySymbol()}${stats.monthlyRevenue.toLocaleString()}`,
      icon: DollarSign,
    },
    {
      title: cleanText(t('pendingIssues')),
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
            <h1 className="text-3xl font-bold">{cleanText(t('propertyManagement') || "Property Management")}</h1>
            <p className="text-muted-foreground">{cleanText(t('manageEfficiently') || "Manage your properties and tenants efficiently.")}</p>
          </div>
          <Button onClick={() => router.push("/dashboard/landlord/add-property")}>
            <Plus className="mr-2 h-4 w-4" />
            {cleanText(t('addProperty') || "Add Property")}
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
                  </div>
                  <stat.icon className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{cleanText(t('recentActivity'))}</CardTitle>
            <CardDescription>{cleanText(t('latestUpdates'))}</CardDescription>
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
                      {activity.displayStatus || activity.status.replace(/^(dashboard\.|property\.)/i, '').replace("_", " ")}
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
            <TabsTrigger value="ai-search">{cleanText(t('aiSmartSearch'))}</TabsTrigger>
            <TabsTrigger value="properties">{cleanText(t('properties'))}</TabsTrigger>
            <TabsTrigger value="applications">{cleanText(t('applications'))}</TabsTrigger>
            <TabsTrigger value="tenants">{cleanText(t('tenants'))}</TabsTrigger>
            <TabsTrigger value="payments">{cleanText(t('payments'))}</TabsTrigger>
            <TabsTrigger value="messages">{cleanText(t('messages'))}</TabsTrigger>
          </TabsList>

          <TabsContent value="ai-search" className="space-y-6">
            {activeTab === "ai-search" && <AIChat userType="landlord" />}
          </TabsContent>

          <TabsContent value="properties">
            {activeTab === "properties" && <PropertyManagement userId={currentUser?.id} />}
          </TabsContent>

          <TabsContent value="applications">
            {activeTab === "applications" && <TenantApplications />}
          </TabsContent>

          <TabsContent value="tenants" className="space-y-6">
            {activeTab === "tenants" && (
              <Card>
                <CardHeader>
                  <CardTitle>{cleanText(t('currentTenants'))}</CardTitle>
                  <CardDescription>{cleanText(t('manageTenantRelationships'))}</CardDescription>
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
                                  {cleanText(tenant.propertyName)}
                                </div>
                              )}
                              <Badge variant={tenant.source === 'lease' ? 'default' : 'secondary'} className="mt-1">
                                {tenant.source === 'lease' ? t('activeLease') : t('approved')}
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMessageClick(tenant.id)}
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              {t('message') || "Message"}
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

          <TabsContent value="messages" className="h-[600px]">
            {activeTab === "messages" && <MessageCenter initialUserId={selectedContactId} />}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
