"use client"

import { useState, useEffect } from "react"
import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, DollarSign, Home, Users } from "lucide-react"
import { getCurrencySymbol } from "@/lib/utils"

export default function AnalyticsPage() {
  const t = useTranslations('dashboard')
  const tProperty = useTranslations('property')
  const currencySymbol = getCurrencySymbol()
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    totalProperties: 0,
    activeTenants: 0,
    occupancyRate: 0,
    loading: true
  })

  useEffect(() => {
    fetchAnalyticsData()
  }, [])

  const fetchAnalyticsData = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      // Fetch properties
      const propertiesRes = await fetch("/api/properties", {
        headers: { Authorization: `Bearer ${token}` },
      })
      let totalProperties = 0
      if (propertiesRes.ok) {
        const propertiesData = await propertiesRes.json()
        totalProperties = propertiesData.pagination?.total || propertiesData.properties?.length || 0
      }

      // Fetch applications to get active tenants
      const applicationsRes = await fetch("/api/applications?userType=landlord", {
        headers: { Authorization: `Bearer ${token}` },
      })
      let activeTenants = 0
      if (applicationsRes.ok) {
        const applicationsData = await applicationsRes.json()
        const applications = applicationsData.applications || []
        activeTenants = applications.filter((a: any) => a.status === 'APPROVED').length
      }

      // Fetch leases to calculate occupancy
      let occupiedProperties = 0
      try {
        const leasesRes = await fetch("/api/leases", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (leasesRes.ok) {
          const leasesData = await leasesRes.json()
          const leases = leasesData.leases || []
          // 获取活跃的租约（状态为ACTIVE）
          const activeLeases = leases.filter((l: any) => 
            l.status === 'ACTIVE' || l.status === 'active'
          )
          occupiedProperties = activeLeases.length
        }
      } catch (err) {
        console.warn('Failed to fetch leases:', err)
        // 如果leases API不存在，使用applications中的APPROVED状态作为替代
        if (applicationsRes.ok) {
          const applicationsData = await applicationsRes.json()
          const applications = applicationsData.applications || []
          occupiedProperties = applications.filter((a: any) => a.status === 'APPROVED').length
        }
      }

      // Fetch payments to calculate total revenue
      const paymentsRes = await fetch("/api/payments", {
        headers: { Authorization: `Bearer ${token}` },
      })
      let totalRevenue = 0
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json()
        const payments = paymentsData.payments || []
        
        // 计算总收入：所有已完成的支付
        totalRevenue = payments
          .filter((p: any) => p.status === 'COMPLETED')
          .reduce((sum: number, p: any) => {
            // 如果是租金支付，使用distribution中的landlordNet（扣除平台费和佣金后的净收入）
            if (p.type === 'RENT' && p.distribution) {
              const dist = typeof p.distribution === 'string' ? JSON.parse(p.distribution) : p.distribution
              return sum + (dist.landlordNet || 0)
            }
            // 其他类型的支付，使用全额
            return sum + (p.amount || 0)
          }, 0)
      }

      // 计算入住率
      const occupancyRate = totalProperties > 0 
        ? Math.round((occupiedProperties / totalProperties) * 100) 
        : 0

      setAnalytics({
        totalRevenue,
        totalProperties,
        activeTenants,
        occupancyRate,
        loading: false
      })
    } catch (error) {
      console.error("Failed to fetch analytics data:", error)
      setAnalytics(prev => ({ ...prev, loading: false }))
    }
  }

  return (
    <DashboardLayout userType="landlord">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('analytics')}</h1>
          <p className="text-muted-foreground">{t('viewInsights') || "View insights about your properties and business"}</p>
        </div>

        {analytics.loading ? (
          <div className="text-center py-8 text-muted-foreground">
            {process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '加载中...' : 'Loading...'}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('totalRevenue') || "Total Revenue"}</p>
                      <p className="text-2xl font-bold">{currencySymbol}{analytics.totalRevenue.toLocaleString()}</p>
                    </div>
                    <DollarSign className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{tProperty('title')}</p>
                      <p className="text-2xl font-bold">{analytics.totalProperties}</p>
                    </div>
                    <Home className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('activeTenants')}</p>
                      <p className="text-2xl font-bold">{analytics.activeTenants}</p>
                    </div>
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('occupancyRate') || "Occupancy Rate"}</p>
                      <p className="text-2xl font-bold">{analytics.occupancyRate}%</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t('analyticsDashboard') || "Analytics Dashboard"}</CardTitle>
                <CardDescription>{t('detailedAnalytics') || "Detailed analytics will be displayed here"}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8">
                  {t('analyticsCharts') || "Analytics charts and graphs will be implemented here"}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
