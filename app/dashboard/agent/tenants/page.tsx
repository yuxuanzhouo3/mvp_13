"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, MessageSquare, Phone, Mail, DollarSign, CreditCard } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function AgentTenantsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

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
        title: "Error",
        description: "Failed to load tenants",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
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
          <h1 className="text-3xl font-bold">Tenant Clients</h1>
          <p className="text-muted-foreground">Tenants you're helping find homes</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tenant Directory</CardTitle>
            <CardDescription>Manage your tenant relationships</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tenants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading tenants...</div>
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
                                ${tenant.tenantProfile.monthlyIncome.toLocaleString()}/mo
                              </div>
                            )}
                            {tenant.tenantProfile.creditScore && (
                              <div className="flex items-center text-sm text-muted-foreground">
                                <CreditCard className="h-4 w-4 mr-1" />
                                Credit: {tenant.tenantProfile.creditScore}
                              </div>
                            )}
                          </>
                        )}
                        <Badge variant="default" className="mt-1">Looking</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/dashboard/agent/messages?userId=${tenant.id}`)}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Message
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No tenants found</p>
                <p className="text-sm mt-2">Help tenants find their perfect home</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
