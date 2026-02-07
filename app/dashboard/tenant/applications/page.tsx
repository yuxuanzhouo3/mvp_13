"use client"

import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getCurrencySymbol } from "@/lib/utils"

export default function ApplicationsPage() {
  const router = useRouter()
  const t = useTranslations('dashboard')
  const tApplication = useTranslations('application')
  const tCommon = useTranslations('common')
  const currencySymbol = getCurrencySymbol()
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const renderStatus = (status?: string) => {
    const s = (status || '').toUpperCase()
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
        return tApplication('status')
    }
  }

  useEffect(() => {
    fetchApplications()
  }, [])

  const fetchApplications = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch("/api/applications?userType=tenant", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setApplications(data.applications || [])
      }
    } catch (error) {
      console.error("Failed to fetch applications:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout userType="tenant">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{tApplication('title')}</h1>
          <p className="text-muted-foreground">{t('trackApplicationStatus') || "Track your application status"}</p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">{tCommon('loading')}</p>
            </CardContent>
          </Card>
        ) : applications.length > 0 ? (
          <div className="space-y-4">
            {applications.map((application) => (
              <Card key={application.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-lg">{application.property?.title || t('property') || "Property"}</div>
                      <div className="text-sm text-muted-foreground">
                        {t('appliedOn') || "Applied on"} {new Date(application.appliedDate || application.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t('deposit') || "Deposit"}: {currencySymbol}{(application.depositAmount || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={application.status === "APPROVED" ? "default" : "secondary"}>
                        {renderStatus(application.status)}
                      </Badge>
                      <div className="mt-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => router.push(`/dashboard/tenant/property/${application.propertyId}`)}
                        >
                          {tCommon('view') || "View"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">{t('noApplicationsYet') || "No applications yet. Start applying to properties!"}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
