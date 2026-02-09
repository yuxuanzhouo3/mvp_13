"use client"

import { useState, useEffect } from "react"
import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, DollarSign, Home, Users } from "lucide-react"
import { getCurrencySymbol } from "@/lib/utils"
import { AnalyticsCharts } from "@/components/dashboard/analytics-charts"

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
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [propertyStatusData, setPropertyStatusData] = useState<any[]>([])

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

        // Calculate property status distribution
        const props = propertiesData.properties || []
        const statusCounts = props.reduce((acc: any, curr: any) => {
          const status = curr.status || 'AVAILABLE'
          acc[status] = (acc[status] || 0) + 1
          return acc
        }, {})

        const pStatusData = [
          { name: tProperty('available') || 'Available', value: statusCounts['AVAILABLE'] || 0, color: '#22c55e' },
          { name: tProperty('occupied') || 'Rented', value: (statusCounts['RENTED'] || 0) + (statusCounts['OCCUPIED'] || 0), color: '#3b82f6' },
          { name: tProperty('maintenance') || 'Maintenance', value: statusCounts['MAINTENANCE'] || 0, color: '#f97316' },
        ].filter(item => item.value > 0)
        
        setPropertyStatusData(pStatusData)
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

        // Calculate revenue trend (last 6 months)
        const regionIsChina = process.env.NEXT_PUBLIC_APP_REGION === 'china'
        const last6Months = Array.from({ length: 6 }, (_, i) => {
          const d = new Date()
          d.setMonth(d.getMonth() - (5 - i))
          return {
            month: d.getMonth(),
            year: d.getFullYear(),
            name: d.toLocaleString(regionIsChina ? 'zh-CN' : 'en-US', { month: 'short' }),
            total: 0
          }
        })

        payments.forEach((p: any) => {
           if (p.status !== 'COMPLETED') return
           const pDate = new Date(p.createdAt || p.paidAt || p.id)
           const pMonth = pDate.getMonth()
           const pYear = pDate.getFullYear()
           
           const monthData = last6Months.find(m => m.month === pMonth && m.year === pYear)
           if (monthData) {
             let amount = p.amount || 0
             if (p.type === 'RENT' && p.distribution) {
                const dist = typeof p.distribution === 'string' ? JSON.parse(p.distribution) : p.distribution
                amount = (dist.landlordNet || 0)
             }
             monthData.total += amount
           }
        })
        
        setRevenueData(last6Months)
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

            <div className="mt-6">
              <AnalyticsCharts 
                revenueData={revenueData} 
                propertyStatusData={propertyStatusData}
                currencySymbol={currencySymbol}
              />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
