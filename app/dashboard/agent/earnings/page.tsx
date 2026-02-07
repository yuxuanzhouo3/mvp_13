"use client"

import { useState, useEffect } from "react"
import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DollarSign, TrendingUp, Calendar, Download, AlertTriangle, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { getCurrencySymbol } from "@/lib/utils"
import Link from "next/link"

export default function AgentEarningsPage() {
  const { toast } = useToast()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const currencySymbol = getCurrencySymbol()
  const [earnings, setEarnings] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalEarnings: 0,
    thisMonth: 0,
    pendingPayouts: 0,
  })
  const [hasPayoutAccount, setHasPayoutAccount] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEarnings()
  }, [])

  const fetchEarnings = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch("/api/agent/earnings", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setEarnings(data.earnings || [])
        setStats({
          totalEarnings: data.totalEarnings || 0,
          thisMonth: data.thisMonth || 0,
          pendingPayouts: data.pendingPayouts || 0,
        })
        setHasPayoutAccount(data.hasPayoutAccount !== false) // Default to true if undefined
      }
    } catch (error) {
      console.error("Failed to fetch earnings:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout userType="agent">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t('earnings')}</h1>
            <p className="text-muted-foreground">{t('trackCommission') || "Track your commission and income"}</p>
          </div>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            {t('exportReport') || "Export Report"}
          </Button>
        </div>

        {/* Payout Account Alert */}
        {!hasPayoutAccount && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Missing Payout Account</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>
                You haven&apos;t linked a payout account yet. You won&apos;t be able to receive your commissions.
              </span>
              <Button variant="outline" size="sm" className="ml-4" asChild>
                <Link href="/dashboard/agent/settings">
                  Link Account
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('totalEarnings') || "Total Earnings"}</p>
                  <p className="text-2xl font-bold">{currencySymbol}{stats.totalEarnings.toLocaleString()}</p>
                </div>
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('thisMonth') || "This Month"}</p>
                  <p className="text-2xl font-bold">{currencySymbol}{stats.thisMonth.toLocaleString()}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('pendingPayouts') || "Pending Payouts"}</p>
                  <p className="text-2xl font-bold">{currencySymbol}{stats.pendingPayouts.toLocaleString()}</p>
                </div>
                <Calendar className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('earningsHistory') || "Earnings History"}</CardTitle>
            <CardDescription>{t('commissionPayments') || "Your commission payments"}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{tCommon('loading')}</div>
            ) : earnings.length > 0 ? (
              <div className="space-y-4">
                {earnings.map((earning: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{earning.description || (t('commissionPayment') || "Commission Payment")}</h3>
                        <Badge variant="outline" className="text-xs font-normal">
                          {earning.propertyTitle || "Property"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Tenant: {earning.tenantName || "Unknown"}
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(earning.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-lg text-green-600">
                        +{currencySymbol}{earning.amount?.toLocaleString() || 0}
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">
                         Total Rent: {currencySymbol}{earning.totalRent?.toLocaleString()}
                      </div>
                      <Badge variant={earning.status === "PAID" ? "default" : (earning.status === "PENDING_RELEASE" ? "secondary" : "outline")}>
                        {earning.status === "PENDING_RELEASE" ? "Held in Escrow" : (earning.status || t('pending'))}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>{t('noEarningsYet') || "No earnings yet"}</p>
                <p className="text-sm mt-2">{t('completeDealsToEarn') || "Complete deals to start earning commissions"}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
