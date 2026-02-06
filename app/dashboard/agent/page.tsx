"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Home, Users, DollarSign, TrendingUp, MessageSquare, FileText, Building, UserPlus } from "lucide-react"
import { PropertyCard } from "@/components/dashboard/property-card"
import { MessageCenter } from "@/components/dashboard/message-center"
import { useToast } from "@/hooks/use-toast"

export default function AgentDashboard() {
  const router = useRouter()
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

  useEffect(() => {
    const userStr = localStorage.getItem("user")
    if (userStr) {
      const user = JSON.parse(userStr)
      setUserName(user.name || "Agent")
      
      // Verify user is an agent
      if (user.userType !== "AGENT") {
        toast({
          title: tCommon('error'),
          description: t('accessDenied') || "This page is only for agents",
          variant: "destructive",
        })
        if (user.userType === "TENANT") {
          router.push("/dashboard/tenant")
        } else if (user.userType === "LANDLORD") {
          router.push("/dashboard/landlord")
        }
        return
      }
    }
    
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      // Fetch agent statistics
      const [propertiesRes, landlordRes, tenantRes, messagesRes] = await Promise.all([
        fetch("/api/agent/properties", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/agent/landlords", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/agent/tenants", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/messages/unread-count", { headers: { Authorization: `Bearer ${token}` } }),
      ])

      if (propertiesRes.ok) {
        const data = await propertiesRes.json()
        setProperties(data.properties || [])
        setStats(prev => ({ ...prev, totalProperties: data.properties?.length || 0 }))
      }

      if (landlordRes.ok) {
        const data = await landlordRes.json()
        setLandlords(data.landlords || [])
        setStats(prev => ({ ...prev, totalLandlords: data.landlords?.length || 0 }))
      }

      if (tenantRes.ok) {
        const data = await tenantRes.json()
        setTenants(data.tenants || [])
        setStats(prev => ({ ...prev, totalTenants: data.tenants?.length || 0 }))
      }

      if (messagesRes.ok) {
        const data = await messagesRes.json()
        setStats(prev => ({ ...prev, unreadMessages: data.count || 0 }))
      }

      // Fetch recent activity
      const activityRes = await fetch("/api/agent/activity", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (activityRes.ok) {
        const data = await activityRes.json()
        setRecentActivity(data.activities || [])
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
            <h1 className="text-3xl font-bold">{t('welcomeBackAgent', { name: userName }) || `${t('welcome')}, ${userName}!`}</h1>
            <p className="text-muted-foreground">{t('manageEfficiently') || "Manage your properties, landlords, and tenants efficiently."}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push("/dashboard/agent/tenants")}>
              <UserPlus className="h-4 w-4 mr-2" />
              {t('inviteTenant') || "Invite Tenant"}
            </Button>
            <Button variant="outline" onClick={() => router.push("/dashboard/agent/landlords")}>
              <UserPlus className="h-4 w-4 mr-2" />
              {t('inviteLandlord') || "Invite Landlord"}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('totalProperties')}</p>
                  <p className="text-2xl font-bold">{stats.totalProperties}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('propertiesUnderManagement') || "Properties under management"}</p>
                </div>
                <Building className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('landlords')}</p>
                  <p className="text-2xl font-bold">{stats.totalLandlords}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('partnerLandlords') || "Partner landlords"}</p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('tenantsServed') || "Tenants Served"}</p>
                  <p className="text-2xl font-bold">{stats.totalTenants}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('activeTenantRelationships') || "Active tenant relationships"}</p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('unreadMessages') || "Unread Messages"}</p>
                  <p className="text-2xl font-bold">{stats.unreadMessages}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('newMessages') || "New messages"}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>{t('recentActivity')}</CardTitle>
            <CardDescription>{t('latestUpdatesFromNetwork') || "Latest updates from your network"}</CardDescription>
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
                        <div className="text-sm text-muted-foreground">{activity.time}</div>
                      </div>
                    </div>
                    <Badge variant={activity.type === "success" ? "default" : "secondary"}>
                      {activity.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">{t('noRecentActivity') || "No recent activity"}</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="properties" className="space-y-6">
          <TabsList>
            <TabsTrigger value="properties">{t('properties')}</TabsTrigger>
            <TabsTrigger value="landlords">{t('landlords')}</TabsTrigger>
            <TabsTrigger value="tenants">{t('tenants')}</TabsTrigger>
            <TabsTrigger value="messages">{t('messages')}</TabsTrigger>
          </TabsList>

          <TabsContent value="properties">
            <Card>
              <CardHeader>
                <CardTitle>{t('managedProperties') || "Managed Properties"}</CardTitle>
                <CardDescription>{t('propertiesUnderManagement') || "Properties under your management"}</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">{tCommon('loading')}</div>
                ) : properties.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {properties.map((property: any) => (
                      <PropertyCard
                        key={property.id}
                        property={{
                          id: property.id,
                          title: property.title,
                          location: `${property.city}, ${property.state}`,
                          price: property.price,
                          beds: property.bedrooms,
                          baths: property.bathrooms,
                          sqft: property.sqft || 0,
                          image: typeof property.images === 'string'
                            ? (JSON.parse(property.images)?.[0] || '/placeholder.svg')
                            : (property.images?.[0] || '/placeholder.svg'),
                          status: property.status?.toLowerCase() || 'available',
                        }}
                        showSaveButton={false}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('noPropertiesYet') || "No properties yet. Start by connecting with landlords."}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="landlords">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{t('partnerLandlords') || "Partner Landlords"}</CardTitle>
                  <CardDescription>{t('landlordsYouWorkWith') || "Landlords you work with"}</CardDescription>
                </div>
                {landlords.length > 4 && (
                  <Button variant="outline" onClick={() => router.push("/dashboard/agent/landlords")}>
                    {tCommon('view') || "View All"}
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
                          {t('messages')}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('noLandlordsYet') || "No landlords yet"}
                  </div>
                )}
                {landlords.length > 0 && landlords.length <= 4 && (
                  <div className="mt-4 text-center">
                    <Button variant="outline" onClick={() => router.push("/dashboard/agent/landlords")}>
                      {t('viewAllLandlords') || "View All Landlords"}
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
                  <CardTitle>{t('tenantClients') || "Tenant Clients"}</CardTitle>
                  <CardDescription>{t('tenantsYouHelping') || "Tenants you're helping find homes"}</CardDescription>
                </div>
                {tenants.length > 4 && (
                  <Button variant="outline" onClick={() => router.push("/dashboard/agent/tenants")}>
                    {tCommon('view') || "View All"}
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
                          {t('messages')}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('noTenantsYet') || "No tenants yet"}
                  </div>
                )}
                {tenants.length > 0 && tenants.length <= 4 && (
                  <div className="mt-4 text-center">
                    <Button variant="outline" onClick={() => router.push("/dashboard/agent/tenants")}>
                      {t('viewAllTenants') || "View All Tenants"}
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
