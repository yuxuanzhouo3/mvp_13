"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
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
import { getCurrencySymbol } from "@/lib/utils"

export default function LandlordDashboard() {
  const router = useRouter()
  const t = useTranslations('dashboard')
  const tProperty = useTranslations('property')
  const tApplication = useTranslations('application')
  const [stats, setStats] = useState({
    totalProperties: 0,
    activeTenants: 0,
    monthlyRevenue: 0,
    pendingIssues: 0,
  })
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState("")
  const currencySymbol = getCurrencySymbol()

  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        if (parsed?.name) {
          setUserName(parsed.name)
        }
      } catch {
        setUserName("")
      }
    }
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
        const regionIsChina = process.env.NEXT_PUBLIC_APP_REGION === 'china'
        const recent = applications.slice(0, 3).map((app: any) => {
          const dt = new Date(app.appliedDate || app.createdAt)
          const y = dt.getFullYear()
          const m = String(dt.getMonth() + 1).padStart(2, '0')
          const d = String(dt.getDate()).padStart(2, '0')
          const hh = String(dt.getHours()).padStart(2, '0')
          const mm = String(dt.getMinutes()).padStart(2, '0')
          const timeStr = regionIsChina ? `${y}-${m}-${d} ${hh}:${mm}` : dt.toLocaleString()
          const getLocalizedStatus = (status: string) => {
            if (!status) return "PENDING"
            const upper = status.toUpperCase()
            switch (upper) {
              case 'PENDING': return tApplication('pending')
              case 'APPROVED': return tApplication('approved')
              case 'REJECTED': return tApplication('rejected')
              case 'WITHDRAWN': return tApplication('withdrawn')
              case 'AGENT_APPROVED': return tApplication('agentApproved') || "Agent Approved"
              default: return status
            }
          }

          return {
            id: app.id,
            type: "application",
            message: regionIsChina 
              ? t('newApplicationForProperty', { title: app.property?.title || t('property') })
              : `New application for ${app.property?.title || 'Property'}`,
            time: timeStr,
            status: getLocalizedStatus(app.status || "PENDING"),
          }
        })
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

      // Fetch payments to calculate monthly revenue
      const paymentsRes = await fetch("/api/payments", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json()
        const payments = paymentsData.payments || []
        
        // 计算本月总收入：已完成的支付金额
        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()
        
        const monthlyRevenue = payments
          .filter((p: any) => {
            // 只计算已完成的支付
            if (p.status !== 'COMPLETED') return false
            
            // 计算本月的支付
            const paymentDate = new Date(p.createdAt || p.paidAt || p.id)
            return paymentDate.getMonth() === currentMonth && 
                   paymentDate.getFullYear() === currentYear
          })
          .reduce((sum: number, p: any) => {
            // 如果是租金支付，使用distribution中的landlordNet（扣除平台费和佣金后的净收入）
            if (p.type === 'RENT' && p.distribution && typeof p.distribution === 'object') {
              const dist = typeof p.distribution === 'string' ? JSON.parse(p.distribution) : p.distribution
              return sum + (dist.landlordNet || 0)
            }
            // 其他类型的支付，使用全额
            return sum + (p.amount || 0)
          }, 0)
        
        setStats(prev => ({ ...prev, monthlyRevenue }))
        
        // 计算待处理问题（争议和待处理的申请）
        const pendingIssues = payments.filter((p: any) => 
          p.status === 'PENDING' || p.escrowStatus === 'HELD_IN_ESCROW'
        ).length
        
        setStats(prev => ({ ...prev, pendingIssues }))
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const statsCards = [
    {
      title: t('totalProperties'),
      value: stats.totalProperties.toString(),
      change: "",
      icon: Home,
    },
    {
      title: t('activeTenants'),
      value: stats.activeTenants.toString(),
      change: "",
      icon: Users,
    },
    {
      title: t('monthlyRevenue'),
      value: `${currencySymbol}${stats.monthlyRevenue.toLocaleString()}`,
      change: "",
      icon: DollarSign,
    },
    {
      title: t('pendingIssues'),
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
            <h1 className="text-3xl font-bold">{t('welcome')}{userName ? ` ${userName}` : ""}</h1>
            <p className="text-muted-foreground">{t('manageProperties') || "高效管理您的房源与租客"}</p>
          </div>
          <Button onClick={() => router.push("/dashboard/landlord/add-property")}>
            <Plus className="mr-2 h-4 w-4" />
            {tProperty('addProperty')}
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
                    <Badge variant={activity.status === "APPROVED" || activity.status === "COMPLETED" ? "default" : "secondary"}>
                      {(() => {
                        const s = (activity.status || '').toUpperCase()
                        switch (s) {
                          case 'APPROVED':
                            return tApplication('approved')
                          case 'PENDING':
                            return tApplication('pending')
                          case 'REJECTED':
                            return tApplication('rejected')
                          case 'WITHDRAWN':
                            return tApplication('withdrawn')
                          case 'UNDER_REVIEW':
                            return tApplication('underReview')
                          default:
                            return activity.status
                        }
                      })()}
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
            <TabsTrigger value="properties">{tProperty('title')}</TabsTrigger>
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
                              {tenant.source === 'lease' ? (t('activeLease') || 'Active Lease') : (t('approved') || 'Approved')}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/dashboard/landlord/messages?userId=${tenant.id}`)}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            {t('messages')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('noActiveTenants')}
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
