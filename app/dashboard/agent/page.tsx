"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Home, Users, DollarSign, TrendingUp, MessageSquare, FileText, Building, UserPlus } from "lucide-react"
import { PropertyCard } from "@/components/dashboard/property-card"
import { TenantApplications } from "@/components/dashboard/tenant-applications"
import { MessageCenter } from "@/components/dashboard/message-center"
import { useToast } from "@/hooks/use-toast"

function AgentDashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialUserId = searchParams.get('userId')
  const { toast } = useToast()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const [stats, setStats] = useState({
    totalProperties: 0,
    totalLandlords: 0,
    totalTenants: 0,
    monthlyEarnings: 0,
    pendingDeals: 0,
    unreadMessages: 0,
  })
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [landlords, setLandlords] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [userName, setUserName] = useState("Agent")
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("properties")

  const handleUnauthorized = () => {
    localStorage.removeItem("auth-token")
    localStorage.removeItem("user")
    toast({
      title: tCommon('error'),
      description: t('loginRequired') || "Session expired, please login again",
      variant: "destructive",
    })
    router.replace("/auth/login")
  }

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
        setUserName(user.name || "Agent")
        const userType = String(user.userType || "").toUpperCase()
        if (userType !== "AGENT") {
          toast({
            title: tCommon('error'),
            description: t('accessDenied') || "This page is only for agents",
            variant: "destructive",
          })
          if (userType === "TENANT") {
            router.push("/dashboard/tenant")
          } else if (userType === "LANDLORD") {
            router.push("/dashboard/landlord")
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

  const localizeRelativeTime = (time?: string) => {
    if (process.env.NEXT_PUBLIC_APP_REGION !== 'china' || !time) return time || ''
    const v = (time || '').toLowerCase()
    return v
      .replace(/just now/g, '刚刚')
      .replace(/(\d+)\s*minutes?\s*ago/g, '$1 分钟前')
      .replace(/(\d+)\s*hours?\s*ago/g, '$1 小时前')
      .replace(/(\d+)\s*days?\s*ago/g, '$1 天前')
      .replace(/(\d+)\s*months?\s*ago/g, '$1 个月前')
  }

  const cleanText = (text: string) => {
    if (!text) return ''
    return text.replace(/^(dashboard\.|property\.|common\.|application\.|payment\.)/i, '')
  }

  const localizeStatus = (status?: string) => {
    let s = (status || '').toLowerCase()
    // Remove prefixes if present
    s = s.replace(/^(dashboard\.|property\.|common\.|application\.|payment\.)/i, '')
    
    if (process.env.NEXT_PUBLIC_APP_REGION !== 'china') return cleanText(status || '')
    
    switch (s) {
      case 'success':
        return tCommon('success')
      case 'pending':
        return t('pending')
      case 'approved':
        return t('approved')
      case 'completed':
        return tCommon('success')
      case 'failed':
        return t('failed') || '失败'
      default:
        return cleanText(status || '')
    }
  }

  const fetchWithTimeout = async (url: string, options?: RequestInit, timeoutMs = 12000) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, { ...(options || {}), signal: controller.signal })
    } finally {
      clearTimeout(timeoutId)
    }
  }

  const fetchDashboardData = async (providedToken: string, currentUser: any) => {
    try {
      const token = providedToken
      const user = currentUser
      if (!token || !user) {
        router.replace("/auth/login")
        return
      }

      const [propertiesResult, landlordResult, tenantResult, messagesResult, pendingAppsResult] = await Promise.allSettled([
        fetchWithTimeout(`/api/agent/properties`, { headers: { Authorization: `Bearer ${token}` } }),
        fetchWithTimeout(`/api/agent/landlords`, { headers: { Authorization: `Bearer ${token}` } }),
        fetchWithTimeout(`/api/agent/tenants`, { headers: { Authorization: `Bearer ${token}` } }),
        fetchWithTimeout("/api/messages/unread-count", { headers: { Authorization: `Bearer ${token}` } }),
        fetchWithTimeout(`/api/applications?status=PENDING&agentId=${user.id}`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const propertiesRes = propertiesResult.status === 'fulfilled' ? propertiesResult.value : null
      const landlordRes = landlordResult.status === 'fulfilled' ? landlordResult.value : null
      const tenantRes = tenantResult.status === 'fulfilled' ? tenantResult.value : null
      const messagesRes = messagesResult.status === 'fulfilled' ? messagesResult.value : null
      const pendingAppsRes = pendingAppsResult.status === 'fulfilled' ? pendingAppsResult.value : null

      const unauthorized = [propertiesRes, landlordRes, tenantRes, messagesRes, pendingAppsRes].filter(
        (res) => res?.status === 401 || res?.status === 403
      )
      // Only logout if multiple requests fail with 401, indicating invalid token
      if (unauthorized.length >= 3) {
        handleUnauthorized()
        return
      }

      if (propertiesRes?.ok) {
        const data = await propertiesRes.json()
        const propertiesList = Array.isArray(data) ? data : data.properties || []
        setProperties(propertiesList)
        setStats(prev => ({ ...prev, totalProperties: propertiesList.length }))
      }

      if (landlordRes?.ok) {
        const data = await landlordRes.json()
        setLandlords(Array.isArray(data) ? data : data.landlords || [])
        setStats(prev => ({ ...prev, totalLandlords: (Array.isArray(data) ? data : data.landlords || []).length }))
      }

      if (tenantRes?.ok) {
        const data = await tenantRes.json()
        setTenants(Array.isArray(data) ? data : data.tenants || [])
        setStats(prev => ({ ...prev, totalTenants: (Array.isArray(data) ? data : data.tenants || []).length }))
      }

      if (messagesRes?.ok) {
        const data = await messagesRes.json()
        setStats(prev => ({ ...prev, unreadMessages: data.count || 0 }))
      }
      
      if (pendingAppsRes?.ok) {
        const data = await pendingAppsRes.json()
        const apps = Array.isArray(data) ? data : data.applications || []
        setStats(prev => ({ ...prev, pendingDeals: apps.length }))
      }

      const activityResult = await Promise.allSettled([
        fetchWithTimeout("/api/agent/activity", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])
      const activityRes = activityResult[0].status === 'fulfilled' ? activityResult[0].value : null
      if (activityRes) {
        if (activityRes.status === 401 || activityRes.status === 403) {
          handleUnauthorized()
          return
        }
        if (activityRes.ok) {
          const data = await activityRes.json()
          setRecentActivity(data.activities || [])
        }
      }

    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout userType="agent">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{cleanText(t('welcomeBackAgent', { name: userName }) || `${t('welcome')}, ${userName}!`)}</h1>
            <p className="text-muted-foreground">{cleanText(t('manageEfficiently') || "Manage your properties, landlords, and tenants efficiently.")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/dashboard/agent/tenants")}>
              <UserPlus className="h-4 w-4 mr-2" />
              {cleanText(t('inviteTenant') || "Invite Tenant")}
            </Button>
            <Button variant="outline" onClick={() => router.push("/dashboard/agent/landlords")}>
              <UserPlus className="h-4 w-4 mr-2" />
              {cleanText(t('inviteLandlord') || "Invite Landlord")}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{cleanText(t('totalProperties'))}</p>
                  <p className="text-2xl font-bold">{stats.totalProperties}</p>
                  <p className="text-xs text-muted-foreground mt-1">{cleanText(t('propertiesUnderManagement') || "Properties under management")}</p>
                </div>
                <Building className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{cleanText(t('landlords'))}</p>
                  <p className="text-2xl font-bold">{stats.totalLandlords}</p>
                  <p className="text-xs text-muted-foreground mt-1">{cleanText(t('partnerLandlords') || "Partner landlords")}</p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{cleanText(t('tenantsServed') || "Tenants Served")}</p>
                  <p className="text-2xl font-bold">{stats.totalTenants}</p>
                  <p className="text-xs text-muted-foreground mt-1">{cleanText(t('activeTenantRelationships') || "Active tenant relationships")}</p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{cleanText(t('unreadMessages') || "Unread Messages")}</p>
                  <p className="text-2xl font-bold">{stats.unreadMessages}</p>
                  <p className="text-xs text-muted-foreground mt-1">{cleanText(t('newMessages') || "New messages")}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>{cleanText(t('recentActivity'))}</CardTitle>
            <CardDescription>{cleanText(t('latestUpdatesFromNetwork') || "Latest updates from your network")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <div>
                        <div className="font-medium">{activity.message}</div>
                        <div className="text-sm text-muted-foreground">{localizeRelativeTime(activity.time)}</div>
                      </div>
                    </div>
                    <Badge variant={activity.type === "success" ? "default" : "secondary"}>
                      {localizeStatus(activity.status)}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">{cleanText(t('noRecentActivity') || "No recent activity")}</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="properties">{cleanText(t('properties'))}</TabsTrigger>
            <TabsTrigger value="applications">{cleanText(t('applications') || "Applications")}</TabsTrigger>
            <TabsTrigger value="landlords">{cleanText(t('landlords'))}</TabsTrigger>
            <TabsTrigger value="tenants">{cleanText(t('tenants'))}</TabsTrigger>
            <TabsTrigger value="messages">{cleanText(t('messages'))}</TabsTrigger>
          </TabsList>

          <TabsContent value="properties">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{cleanText(t('managedProperties') || "Managed Properties")}</CardTitle>
                    <CardDescription>{cleanText(t('propertiesUnderManagement') || "Properties under your management")}</CardDescription>
                  </div>
                  <Button onClick={() => router.push("/dashboard/agent/add-property")}>
                    <Building className="h-4 w-4 mr-2" />
                    {cleanText(t('addProperty') || "Add Property")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">{cleanText(tCommon('loading'))}</div>
                ) : properties.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {properties.map((property: any) => (
                      <PropertyCard
                        key={property.id}
                        property={{
                          id: property.id,
                          title: cleanText(property.title),
                          location: `${property.city}, ${property.state}`,
                          price: property.price,
                          beds: property.bedrooms,
                          baths: property.bathrooms,
                          sqft: property.sqft || 0,
                          image: typeof property.images === 'string'
                            ? (JSON.parse(property.images)?.[0] || '/placeholder.svg')
                            : (property.images?.[0] || '/placeholder.svg'),
                          status: localizeStatus(property.status),
                        }}
                        showSaveButton={false}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {cleanText(t('noPropertiesYet') || "No properties yet. Start by connecting with landlords.")}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applications">
            <TenantApplications userType="agent" />
          </TabsContent>

          <TabsContent value="landlords">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{cleanText(t('partnerLandlords') || "Partner Landlords")}</CardTitle>
                  <CardDescription>{cleanText(t('landlordsYouWorkWith') || "Landlords you work with")}</CardDescription>
                </div>
                {landlords.length > 4 && (
                  <Button variant="outline" onClick={() => router.push("/dashboard/agent/landlords")}>
                    {cleanText(tCommon('view') || "View All")}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {landlords.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {landlords.slice(0, 4).map((landlord) => (
                      <div key={landlord.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{landlord.name}</div>
                            <div className="text-sm text-muted-foreground">{landlord.email}</div>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => router.push(`/dashboard/agent/messages?userId=${landlord.id}`)}
                        >
                          {cleanText(t('messages'))}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {cleanText(t('noLandlordsYet') || "No landlords yet")}
                  </div>
                )}
                {landlords.length > 0 && landlords.length <= 4 && (
                  <div className="mt-4 text-center">
                    <Button variant="outline" onClick={() => router.push("/dashboard/agent/landlords")}>
                      {cleanText(t('viewAllLandlords') || "View All Landlords")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tenants">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{cleanText(t('tenantClients') || "Tenant Clients")}</CardTitle>
                  <CardDescription>{cleanText(t('tenantsYouHelping') || "Tenants you're helping find homes")}</CardDescription>
                </div>
                {tenants.length > 4 && (
                  <Button variant="outline" onClick={() => router.push("/dashboard/agent/tenants")}>
                    {cleanText(tCommon('view') || "View All")}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {tenants.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tenants.slice(0, 4).map((tenant) => (
                      <div key={tenant.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{tenant.name}</div>
                            <div className="text-sm text-muted-foreground">{tenant.email}</div>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => router.push(`/dashboard/agent/messages?userId=${tenant.id}`)}
                        >
                          {cleanText(t('messages'))}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {cleanText(t('noTenantsYet') || "No tenants yet")}
                  </div>
                )}
                {tenants.length > 0 && tenants.length <= 4 && (
                  <div className="mt-4 text-center">
                    <Button variant="outline" onClick={() => router.push("/dashboard/agent/tenants")}>
                      {cleanText(t('viewAllTenants') || "View All Tenants")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <MessageCenter />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

export default function AgentDashboard() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <AgentDashboardContent />
    </Suspense>
  )
}
