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
