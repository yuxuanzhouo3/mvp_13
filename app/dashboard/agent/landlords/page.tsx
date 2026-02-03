"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, MessageSquare, Home, Phone, Mail } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function AgentLandlordsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [landlords, setLandlords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchLandlords()
  }, [])

  const fetchLandlords = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch("/api/agent/landlords", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setLandlords(data.landlords || [])
      }
    } catch (error) {
      console.error("Failed to fetch landlords:", error)
      toast({
        title: "Error",
        description: "Failed to load landlords",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredLandlords = landlords.filter(landlord =>
    landlord.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    landlord.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <DashboardLayout userType="agent">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Partner Landlords</h1>
          <p className="text-muted-foreground">Manage your landlord relationships</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Landlord Directory</CardTitle>
            <CardDescription>Landlords you work with</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search landlords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading landlords...</div>
            ) : filteredLandlords.length > 0 ? (
              <div className="space-y-4">
                {filteredLandlords.map((landlord: any) => (
                  <div key={landlord.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${landlord.name}`} />
                        <AvatarFallback>
                          {landlord.name?.split(' ').map((n: string) => n[0]).join('') || 'LL'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{landlord.name}</h3>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Mail className="h-3 w-3 mr-1" />
                          {landlord.email}
                        </div>
                        {landlord.phone && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Phone className="h-3 w-3 mr-1" />
                            {landlord.phone}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="flex items-center text-sm">
                          <Home className="h-4 w-4 mr-1" />
                          {landlord.propertyCount || 0} properties
                        </div>
                        <Badge variant="default" className="mt-1">Active</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/dashboard/agent/messages?userId=${landlord.id}`)}
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
                <p>No landlords found</p>
                <p className="text-sm mt-2">Start networking with landlords to build partnerships</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
