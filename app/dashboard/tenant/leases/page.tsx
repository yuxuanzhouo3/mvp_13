"use client"

import { useState, useEffect } from "react"
import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Home, DollarSign, User, CreditCard } from "lucide-react"
import { getCurrencySymbol } from "@/lib/utils"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function TenantLeasesPage() {
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const { toast } = useToast()
  const currencySymbol = getCurrencySymbol()
  
  const [leases, setLeases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [payingLease, setPayingLease] = useState<any>(null)
  const [payAmount, setPayAmount] = useState("")
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchLeases()
  }, [])

  const fetchLeases = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch("/api/tenant/leases", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setLeases(data.leases || [])
      }
    } catch (error) {
      console.error("Failed to fetch leases:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePayRent = async () => {
    if (!payingLease || !payAmount) return

    setProcessing(true)
    try {
      const token = localStorage.getItem("auth-token")
      const response = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          type: 'RENT',
          leaseId: payingLease.id,
          amount: parseFloat(payAmount),
          paymentMethod: 'card' // Default
        }),
      })

      const data = await response.json()

      if (response.ok) {
        if (data.paymentUrl) {
           // Redirect to external payment page (e.g. CloudBase/WeChat/Alipay)
           window.location.href = data.paymentUrl
        } else {
           // Stripe flow (Mock success for now as we don't have Elements here)
           toast({
             title: "Payment Initiated",
             description: "Redirecting to payment processor...",
           })
           // Simulate redirect to payments page
           setTimeout(() => {
             window.location.href = '/dashboard/tenant/payments'
           }, 1500)
        }
      } else {
        throw new Error(data.error || "Payment failed")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
      setProcessing(false)
    }
  }

  const openPaymentDialog = (lease: any) => {
    setPayingLease(lease)
    setPayAmount(lease.rentAmount.toString())
  }

  return (
    <DashboardLayout userType="tenant">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('myLeases') || "My Leases"}</h1>
          <p className="text-muted-foreground">{t('viewLeaseAgreements') || "View and manage your lease agreements"}</p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">{tCommon('loading')}</div>
        ) : leases.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {leases.map((lease) => (
              <Card key={lease.id} className="overflow-hidden">
                <div className="h-48 bg-muted relative">
                  {lease.property?.images?.[0] ? (
                    <img 
                      src={lease.property.images[0]} 
                      alt={lease.property.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-gray-100">
                      <Home className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <Badge className="absolute top-4 right-4" variant={lease.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {lease.status}
                  </Badge>
                </div>
                <CardHeader>
                  <CardTitle>{lease.property?.title || 'Unknown Property'}</CardTitle>
                  <CardDescription>{lease.property?.address}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-2" />
                      Term
                    </div>
                    <span className="font-medium">
                      {new Date(lease.startDate).toLocaleDateString()} - {new Date(lease.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Rent
                    </div>
                    <span className="font-medium">{currencySymbol}{lease.rentAmount}/mo</span>
                  </div>
                  {lease.listingAgent && (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <User className="h-4 w-4 mr-2" />
                        Agent
                      </div>
                      <span className="font-medium">{lease.listingAgent.name}</span>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="w-full" onClick={() => openPaymentDialog(lease)}>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pay Rent
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Pay Rent</DialogTitle>
                        <DialogDescription>
                          Make a rent payment for {lease.property?.title}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="amount" className="text-right">
                            Amount
                          </Label>
                          <div className="col-span-3 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              {currencySymbol}
                            </span>
                            <Input
                              id="amount"
                              type="number"
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              className="pl-8"
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handlePayRent} disabled={processing}>
                          {processing ? "Processing..." : "Confirm Payment"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No active leases found.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
