"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Check, X, Eye, MessageSquare } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getCurrencySymbol } from "@/lib/utils"

export function TenantApplications() {
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('dashboard')
  const tApplication = useTranslations('application')
  const tCommon = useTranslations('common')
  const currencySymbol = getCurrencySymbol()
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchApplications()
  }, [])

  const fetchApplications = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch("/api/applications?userType=landlord", {
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

  const handleApprove = async (applicationId: string) => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "APPROVED" }),
      })

      if (response.ok) {
        toast({
          title: tCommon('success'),
          description: tApplication('approved') || "The application has been approved successfully",
        })
        fetchApplications()
      } else {
        throw new Error(tCommon('error') || "Failed to approve application")
      }
    } catch (error: any) {
      toast({
        title: tCommon('error'),
        description: error.message || tCommon('error'),
        variant: "destructive",
      })
    }
  }

  const handleDecline = async (applicationId: string) => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "REJECTED" }),
      })

      if (response.ok) {
        toast({
          title: tCommon('success'),
          description: tApplication('rejected') || "The application has been declined",
        })
        fetchApplications()
      } else {
        throw new Error(tCommon('error') || "Failed to decline application")
      }
    } catch (error: any) {
      toast({
        title: tCommon('error'),
        description: error.message || tCommon('error'),
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('tenantApplications')}</CardTitle>
          <CardDescription>{t('reviewAndManageApplications')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">{tCommon('loading')}</div>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('tenantApplications')}</CardTitle>
        <CardDescription>{t('reviewAndManageApplications')}</CardDescription>
      </CardHeader>
      <CardContent>
        {applications.length > 0 ? (
          <div className="space-y-6">
            {applications.map((application) => (
              <div key={application.id} className="border rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src="/placeholder.svg"
                        alt={application.tenant?.name || "Tenant"}
                      />
                      <AvatarFallback>
                        {(application.tenant?.name || "T")
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-lg">{application.tenant?.name || "Tenant"}</h3>
                      <p className="text-sm text-muted-foreground">{application.tenant?.email || ""}</p>
                      <p className="text-sm text-muted-foreground">{application.tenant?.phone || ""}</p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      application.status === "APPROVED"
                        ? "default"
                        : application.status === "PENDING"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {application.status?.replace("_", " ").toLowerCase() || "pending"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Property</p>
                    <p className="text-sm text-muted-foreground">{application.property?.title || "Property"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Applied Date</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(application.appliedDate || application.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Deposit Amount</p>
                    <p className="text-sm text-muted-foreground">{currencySymbol}{(application.depositAmount || 0).toLocaleString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Monthly Income</p>
                    <p className="text-sm text-muted-foreground">{currencySymbol}{(application.monthlyIncome || application.tenant?.tenantProfile?.monthlyIncome || 0).toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Credit Score</p>
                    <p className="text-sm text-muted-foreground">{application.creditScore || application.tenant?.tenantProfile?.creditScore || "N/A"}</p>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => router.push(`/properties/${application.propertyId}`)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    {tCommon('view') || "View Details"}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => router.push(`/dashboard/landlord/messages?userId=${application.tenantId}`)}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {t('messages')}
                  </Button>
                  {application.status === "PENDING" && (
                    <>
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => handleApprove(application.id)}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        {tApplication('approved') || "Approve"}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleDecline(application.id)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        {tApplication('rejected') || "Decline"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">{t('noApplicationsFound')}</div>
        )}
      </CardContent>
    </Card>
  )
}
