"use client"

import { useState, useEffect } from "react"
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, CreditCard, Shield } from "lucide-react"
import { getCurrencySymbol } from "@/lib/utils"

interface PaymentHistoryProps {
  userType: "tenant" | "landlord"
}

export function PaymentHistory({ userType }: PaymentHistoryProps) {
  const t = useTranslations('dashboard')
  const tPayment = useTranslations('payment')
  const tCommon = useTranslations('common')
  const currencySymbol = getCurrencySymbol()
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch("/api/payments", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setPayments(data.payments || [])
      }
    } catch (error) {
      console.error("Failed to fetch payments:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmCheckIn = async (paymentId: string) => {
    if (!confirm(t('confirmCheckInPrompt') || "Are you sure you want to confirm check-in? This will release the funds to the landlord.")) return

    try {
      const token = localStorage.getItem("auth-token")
      const response = await fetch(`/api/payments/${paymentId}/release`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Refresh payments
        fetchPayments()
        // Show success message
        // toast({ title: "Success", description: "Check-in confirmed and funds released." }) // Need to import toast if we want to use it, currently not imported in this component or passed as prop. 
        // Just relying on refresh for now or console.
        console.log("Funds released")
      } else {
        const data = await response.json()
        alert(data.error || "Failed to confirm check-in")
      }
    } catch (error) {
      console.error("Release error:", error)
      alert("An error occurred")
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>{tPayment('title')}</span>
          </CardTitle>
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
        <CardTitle className="flex items-center space-x-2">
          <CreditCard className="h-5 w-5" />
          <span>{tPayment('title')}</span>
        </CardTitle>
        <CardDescription>
          {userType === "tenant"
            ? (t('trackRentPayments') || "Track your rent payments and deposit status")
            : (t('monitorPayments') || "Monitor incoming payments and deposits")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {payments.length > 0 ? (
          <div className="space-y-4">
            {payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                    {payment.type === "DEPOSIT" ? (
                      <Shield className="h-5 w-5 text-primary" />
                    ) : (
                      <CreditCard className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{payment.description || `${payment.type} - ${payment.property?.title || 'Property'}`}</div>
                    <div className="text-sm text-muted-foreground">{new Date(payment.createdAt).toLocaleDateString()}</div>
                    {/* Breakdown for Landlords */}
                    {userType === 'landlord' && payment.distribution && (
                      <div className="mt-2 text-xs space-y-1 bg-muted/50 p-2 rounded w-64">
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <span>{currencySymbol}{payment.amount}</span>
                        </div>
                        <div className="flex justify-between text-destructive">
                          <span>Platform Fee:</span>
                          <span>-{currencySymbol}{payment.distribution.platformFee}</span>
                        </div>
                        {(payment.distribution.listingAgentFee > 0 || payment.distribution.tenantAgentFee > 0) && (
                          <div className="flex justify-between text-destructive">
                            <span>Agent Commission:</span>
                            <span>-{currencySymbol}{((payment.distribution.listingAgentFee || 0) + (payment.distribution.tenantAgentFee || 0)).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-green-600 pt-1 border-t border-border">
                          <span>Net Income:</span>
                          <span>{currencySymbol}{payment.distribution.landlordNet}</span>
                        </div>
                      </div>
                    )}
                    {/* Check-in Button for Tenants */}
                    {userType === 'tenant' && payment.type === 'RENT' && payment.escrowStatus === 'HELD_IN_ESCROW' && (
                      <div className="mt-2">
                         <Button size="sm" onClick={() => handleConfirmCheckIn(payment.id)} className="bg-green-600 hover:bg-green-700 text-white h-8">
                           <Shield className="h-3 w-3 mr-2" />
                           {t('confirmCheckIn') || "Confirm Check-in"}
                         </Button>
                         <p className="text-xs text-muted-foreground mt-1">
                           {t('confirmCheckInDesc') || "Click to release funds to landlord"}
                         </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-semibold text-lg">{currencySymbol}{payment.amount.toLocaleString()}</div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={payment.status === "COMPLETED" ? "default" : "secondary"}>
                      {payment.status.replace("_", " ").toLowerCase()}
                    </Badge>
                    <Button size="sm" variant="ghost">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">{t('noPaymentsFound')}</div>
        )}
      </CardContent>
    </Card>
  )
}
