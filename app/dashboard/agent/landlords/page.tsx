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
import { Search, MessageSquare, Home, Phone, Mail, UserPlus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
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

export default function AgentLandlordsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const [landlords, setLandlords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviting, setInviting] = useState(false)

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
        title: tCommon('error'),
        description: t('loadLandlordsFailed') || "Failed to load landlords",
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
        body: JSON.stringify({ email: inviteEmail, userType: "LANDLORD" }),
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
      
      if (data.status === 'bound') {
        fetchLandlords()
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

  const filteredLandlords = landlords.filter(landlord =>
    landlord.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    landlord.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <DashboardLayout userType="agent">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('partnerLandlords')}</h1>
          <p className="text-muted-foreground">{t('manageLandlordRelationships') || "Manage your landlord relationships"}</p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t('landlordDirectory') || "Landlord Directory"}</CardTitle>
              <CardDescription>{t('landlordsYouWorkWith')}</CardDescription>
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('inviteLandlord') || "Invite Landlord"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('inviteOrBindLandlord') || "Invite or Bind Landlord"}</DialogTitle>
                  <DialogDescription>
                    {t('inviteLandlordDesc') || "Enter the email of the landlord you want to invite. If they are already registered and have no agent, they will be bound to you."}
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
                      placeholder={t('landlordEmailPlaceholder') || "landlord@example.com"}
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
                  placeholder={t('searchLandlords') || "Search landlords..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{tCommon('loading')}</div>
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
                          {landlord.propertyCount || 0} {t('properties')}
                        </div>
                        <Badge variant="default" className="mt-1">{t('active')}</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/dashboard/agent/messages?userId=${landlord.id}`)}
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
                <p>{t('noLandlordsFound') || "No landlords found"}</p>
                <p className="text-sm mt-2">{t('startNetworkingWithLandlords') || "Start networking with landlords to build partnerships"}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
