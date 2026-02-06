"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, MessageSquare, Phone, Mail, DollarSign, CreditCard, UserPlus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getCurrencySymbol } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

export default function AgentTenantsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviting, setInviting] = useState(false)
  const currencySymbol = getCurrencySymbol()

  useEffect(() => {
    fetchTenants()
  }, [])

  const fetchTenants = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch("/api/agent/tenants", {
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

  const handleInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      toast({
        title: tCommon('error'),
        description: t('invalidEmail') || "Please enter a valid email address",
        variant: "destructive",
      })
      return
    }

    setInviting(true)
    try {
      const token = localStorage.getItem("auth-token")
      const response = await fetch("/api/agent/invite", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ email: inviteEmail }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to invite")
      }

      toast({
        title: data.status === 'bound' ? (t('boundSuccess') || "Success") : (t('invitationSent') || "Invitation Sent"),
        description: data.message,
      })

      setInviteOpen(false)
      setInviteEmail("")
      
      // Refresh list if bound
      if (data.status === 'bound') {
        fetchTenants()
      }
    } catch (error: any) {
      toast({
        title: tCommon('error'),
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setInviting(false)
    }
  }

  const filteredTenants = tenants.filter(tenant =>
    tenant.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tenant.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <DashboardLayout userType="agent">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('tenantClients')}</h1>
          <p className="text-muted-foreground">{t('tenantsYouHelping')}</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t('tenantDirectory') || "Tenant Directory"}</CardTitle>
              <CardDescription>{t('manageTenantRelationships')}</CardDescription>
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('inviteTenant') || "Invite Tenant"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('inviteOrBindTenant') || "Invite or Bind Tenant"}</DialogTitle>
                  <DialogDescription>
                    {t('inviteTenantDesc') || "Enter the email of the tenant you want to invite. If they are already registered and have no agent, they will be bound to you."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">
                      {tCommon('email') || "Email"}
                    </Label>
                    <Input
                      id="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder={t('tenantEmailPlaceholder') || "tenant@example.com"}
                      className="col-span-3"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>{tCommon('cancel')}</Button>
                  <Button onClick={handleInvite} disabled={inviting}>
                    {inviting ? (t('processing') || "Processing...") : (t('sendInvitation') || "Send Invitation")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchTenants') || "Search tenants..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{tCommon('loading')}</div>
            ) : filteredTenants.length > 0 ? (
              <div className="space-y-4">
                {filteredTenants.map((tenant: any) => (
                  <div key={tenant.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${tenant.name}`} />
                        <AvatarFallback>
                          {tenant.name?.split(' ').map((n: string) => n[0]).join('') || 'TN'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{tenant.name}</h3>
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
                        {tenant.tenantProfile && (
                          <>
                            {tenant.tenantProfile.monthlyIncome && (
                              <div className="flex items-center text-sm">
                                <DollarSign className="h-4 w-4 mr-1" />
                                {currencySymbol}{tenant.tenantProfile.monthlyIncome.toLocaleString()}/mo
                              </div>
                            )}
                            {tenant.tenantProfile.creditScore && (
                              <div className="flex items-center text-sm text-muted-foreground">
                                <CreditCard className="h-4 w-4 mr-1" />
                                {t('creditScore') || "Credit Score"}: {tenant.tenantProfile.creditScore}
                              </div>
                            )}
                          </>
                        )}
                        <Badge variant="default" className="mt-1">{t('looking') || "Looking"}</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/dashboard/agent/messages?userId=${tenant.id}`)}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        {t('messages')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>{t('noTenantsFound') || "No tenants found"}</p>
                <p className="text-sm mt-2">{t('helpTenantsFindHome') || "Help tenants find their perfect home"}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
