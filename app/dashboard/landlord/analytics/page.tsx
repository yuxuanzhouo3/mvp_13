"use client"

import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, DollarSign, Home, Users } from "lucide-react"
import { getCurrencySymbol } from "@/lib/utils"

export default function AnalyticsPage() {
  const t = useTranslations('dashboard')
  const tProperty = useTranslations('property')
  const currencySymbol = getCurrencySymbol()
  return (
    <DashboardLayout userType="landlord">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('analytics')}</h1>
          <p className="text-muted-foreground">{t('viewInsights') || "View insights about your properties and business"}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('totalRevenue') || "Total Revenue"}</p>
                  <p className="text-2xl font-bold">{currencySymbol}0</p>
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
                  <p className="text-2xl font-bold">0</p>
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
                  <p className="text-2xl font-bold">0</p>
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
                  <p className="text-2xl font-bold">0%</p>
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
      </div>
    </DashboardLayout>
  )
}
