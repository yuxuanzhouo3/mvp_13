"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useState, useEffect } from "react"
import { MessageSquare, Mail, Phone, Home } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getCurrencySymbol } from "@/lib/utils"

export default function TenantsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const currencySymbol = getCurrencySymbol()

  useEffect(() => {
    fetchTenants()
  }, [])

  const fetchTenants = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch("/api/landlord/tenants", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setTenants(data.tenants || [])
      }
    } catch (error) {
      console.error("Failed to fetch tenants:", error)
      toast({
        title: tCommon('error'),
        description: t('loadTenantsFailed') || "Failed to load tenants",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout userType="landlord">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('currentTenants')}</h1>
          <p className="text-muted-foreground">{t('manageTenantRelationships')}</p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">{tCommon('loading')}</div>
        ) : tenants.length > 0 ? (
          <div className="space-y-4">
            {tenants.map((tenant) => (
              <Card key={tenant.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${tenant.name}`} />
                        <AvatarFallback>
                          {tenant.name?.split(' ').map((n: string) => n[0]).join('') || 'TN'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold text-lg">{tenant.name}</div>
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
                        {tenant.leaseStart && tenant.leaseEnd && (
                          <div className="text-sm text-muted-foreground">
                            {new Date(tenant.leaseStart).toLocaleDateString()} - {new Date(tenant.leaseEnd).toLocaleDateString()}
                          </div>
                        )}
                        {tenant.monthlyRent && (
                          <div className="text-sm font-semibold text-primary">
                            {currencySymbol}{tenant.monthlyRent.toLocaleString()}/mo
                          </div>
                        )}
                        <Badge variant={tenant.source === 'lease' ? 'default' : 'secondary'} className="mt-1">
                          {tenant.source === 'lease' ? t('activeLease') : t('approved')}
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
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">{t('noActiveTenants')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
