"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Check, X, Eye, MessageSquare } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getCurrencySymbol } from "@/lib/utils"

interface TenantApplicationsProps {
  userType?: 'landlord' | 'agent'
}

export function TenantApplications({ userType = 'landlord' }: TenantApplicationsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const tApplication = useTranslations('application')
  const tPayment = useTranslations('payment')
  const currencySymbol = getCurrencySymbol()
  const [applications, setApplications] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 9000) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }
  }
  const parseTokenHints = (token: string) => {
    try {
      const payloadBase64 = token.split(".")[1]
      if (!payloadBase64) return { userId: "", email: "" }
      const normalized = payloadBase64.replace(/-/g, "+").replace(/_/g, "/")
      const decoded = JSON.parse(atob(normalized))
      const userId = decoded?.userId || decoded?.sub || decoded?.id || ""
      const email = decoded?.email || decoded?.userEmail || ""
      return { userId: String(userId || ""), email: String(email || "") }
    } catch {
      return { userId: "", email: "" }
    }
  }
  const getAuthHeaders = (token: string) => {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
    const userStr = localStorage.getItem("user")
    let parsedUser: any = null
    if (userStr) {
      try {
        parsedUser = JSON.parse(userStr)
      } catch {
        localStorage.removeItem("user")
      }
    }
    const tokenHints = parseTokenHints(token)
    const hintedId = parsedUser?.id || parsedUser?.userId || parsedUser?._id
    const hintedEmail = parsedUser?.email
    if (hintedId) headers["x-user-id"] = String(hintedId)
    if (hintedEmail) headers["x-user-email"] = String(hintedEmail)
    if (!headers["x-user-id"] && tokenHints.userId) headers["x-user-id"] = tokenHints.userId
    if (!headers["x-user-email"] && tokenHints.email) headers["x-user-email"] = tokenHints.email
    return headers
  }

  const cleanText = (text: string) => {
    if (!text) return ''
    return text.replace(/^(dashboard\.|property\.|common\.|application\.|payment\.)/i, '')
  }

  const renderStatus = (status?: string) => {
    let s = (status || '').toUpperCase()
    s = s.replace(/^(DASHBOARD\.|PROPERTY\.|COMMON\.|APPLICATION\.|PAYMENT\.)/i, '')
    
    switch (s) {
      case 'APPROVED':
        return cleanText(tApplication('approved'))
      case 'PENDING':
        return cleanText(tApplication('pending'))
      case 'REJECTED':
        return cleanText(tApplication('rejected'))
      case 'WITHDRAWN':
        return cleanText(tApplication('withdrawn'))
      case 'UNDER_REVIEW':
        return cleanText(tApplication('underReview'))
      case 'AGENT_APPROVED':
        return cleanText(tApplication('agentApproved') || "Agent Approved")
      default:
        return cleanText(status || '')
    }
  }

  useEffect(() => {
    fetchApplications()
    fetchPayments()
  }, [userType])

  const uniqueApplications = useMemo(() => {
    const map = new Map<string, any>()
    applications.forEach((application) => {
      const tenantId = application.tenantId || application.tenant?.id
      const propertyId = application.propertyId || application.property?.id
      const key = tenantId || propertyId
        ? `tenant:${String(tenantId || 'unknown')}|property:${String(propertyId || 'unknown')}`
        : `id:${String(application.id || '')}`
      const existing = map.get(key)
      const nextTime = new Date(application.appliedDate || application.createdAt || 0).getTime()
      const existingTime = existing ? new Date(existing.appliedDate || existing.createdAt || 0).getTime() : 0
      if (!existing || nextTime >= existingTime) {
        map.set(key, application)
      }
    })
    return Array.from(map.values())
  }, [applications])

  const fetchApplications = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) {
        setLoading(false)
        return
      }

      const response = await fetchWithTimeout(`/api/applications?userType=${userType}`, {
        headers: getAuthHeaders(token),
        credentials: "include",
        cache: "no-store",
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

  const parseMetadata = (payment: any) => {
    const metadata = payment?.metadata
    if (!metadata) return undefined
    if (typeof metadata === 'string') {
      try {
        return JSON.parse(metadata)
      } catch {
        return undefined
      }
    }
    if (typeof metadata === 'object') {
      return metadata
    }
    return undefined
  }

  const fetchPayments = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetchWithTimeout("/api/payments", {
        headers: getAuthHeaders(token),
        credentials: "include",
        cache: 'no-store'
      })

      if (response.ok) {
        const data = await response.json()
        setPayments(data.payments || [])
      }
    } catch (error) {
      console.error("Failed to fetch payments:", error)
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
        body: JSON.stringify({ status: 'APPROVED' }),
      })

      if (response.ok) {
        toast({
          title: tCommon('success'),
          description: userType === 'agent'
            ? (t('agentApproved') || "Application approved by agent")
            : (t('approved') || "The application has been approved successfully"),
        })
        fetchApplications()
      } else {
        const data = await response.json()
        throw new Error(data.error || tCommon('error') || "Failed to approve application")
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
        const data = await response.json()
        throw new Error(data.error || tCommon('error') || "Failed to decline application")
      }
    } catch (error: any) {
      toast({
        title: tCommon('error'),
        description: error.message || tCommon('error'),
        variant: "destructive",
      })
    }
  }

  const canReview = (application: any) => {
    const status = String(application.status || '').toUpperCase()
    if (userType === 'agent') {
      return status === 'PENDING'
    }
    if (userType === 'landlord') {
      return status === 'PENDING'
    }
    return false
  }

  const getPaymentStatus = (application: any) => {
    const tenantId = application.tenantId || application.tenant?.id
    const propertyId = application.propertyId || application.property?.id
    const match = payments.find((p) => {
      const metadata = parseMetadata(p)
      const paymentTenantId = p.userId || p.user?.id || metadata?.tenantId
      const paymentPropertyId = p.propertyId || p.property?.id || metadata?.propertyId
      const type = String(p.type || '').toUpperCase()
      if (type !== 'RENT') return false
      if (tenantId && paymentTenantId && String(paymentTenantId) !== String(tenantId)) return false
      if (propertyId && paymentPropertyId && String(paymentPropertyId) !== String(propertyId)) return false
      return true
    })
    if (!match) return null
    return String(match.status || '').toUpperCase()
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{cleanText(t('tenantApplications'))}</CardTitle>
          <CardDescription>{cleanText(t('reviewAndManageApplications'))}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">{cleanText(tCommon('loading'))}</div>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{cleanText(t('tenantApplications'))}</CardTitle>
        <CardDescription>{cleanText(t('reviewAndManageApplications'))}</CardDescription>
      </CardHeader>
      <CardContent>
        {uniqueApplications.length > 0 ? (
          <div className="space-y-6">
            {uniqueApplications.map((application) => (
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
                  <div className="text-right">
                    <Badge
                      variant={
                        (application.status || '').toUpperCase() === "APPROVED" || (application.status || '').toUpperCase() === "AGENT_APPROVED"
                          ? "default"
                          : (application.status || '').toUpperCase() === "PENDING"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {renderStatus(application.status)}
                    </Badge>
                    {((application.status || '').toUpperCase() === 'APPROVED' || (application.status || '').toUpperCase() === 'AGENT_APPROVED') ? (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {cleanText(tPayment('status') || "Status")}: {(() => {
                          const status = getPaymentStatus(application)
                          if (status === 'COMPLETED' || status === 'PAID') return cleanText(tPayment('completed') || "Paid")
                          return cleanText(tPayment('pending') || "Pending Payment")
                        })()}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{cleanText(t('property'))}</p>
                    <p className="text-sm text-muted-foreground">{cleanText(application.property?.title) || "Property"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{cleanText(t('appliedOn'))}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(application.appliedDate || application.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{cleanText(t('deposit'))}</p>
                    <p className="text-sm text-muted-foreground">{currencySymbol}{(application.depositAmount || 0).toLocaleString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{cleanText(t('monthlyIncome'))}</p>
                    <p className="text-sm text-muted-foreground">{currencySymbol}{(application.monthlyIncome || application.tenant?.tenantProfile?.monthlyIncome || 0).toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{cleanText(t('creditScore'))}</p>
                    <p className="text-sm text-muted-foreground">{application.creditScore || application.tenant?.tenantProfile?.creditScore || "N/A"}</p>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => router.push(`/properties/${application.propertyId || application.property?.id}`)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    {cleanText(tCommon('viewDetails') || tCommon('view'))}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => router.push(`/dashboard/${userType}/messages?userId=${application.tenantId || application.tenant?.id}`)}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {cleanText(t('messages'))}
                  </Button>
                  {canReview(application) && (
                    <>
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => handleApprove(application.id)}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        {cleanText(tApplication('approve'))}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleDecline(application.id)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        {cleanText(tApplication('reject'))}
                      </Button>
                    </>
                  )}
                  {userType === 'landlord' && application.status === 'AGENT_APPROVED' && (
                    <span className="text-sm text-muted-foreground self-center">
                      {cleanText(tApplication('agentApproved') || "Agent Approved")} · {(() => {
                        const status = getPaymentStatus(application)
                        if (status === 'COMPLETED' || status === 'PAID') return cleanText(tPayment('completed') || "Paid")
                        return cleanText(tPayment('pending') || "Pending Payment")
                      })()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">{cleanText(t('noApplicationsFound'))}</div>
        )}
      </CardContent>
    </Card>
  )
}
