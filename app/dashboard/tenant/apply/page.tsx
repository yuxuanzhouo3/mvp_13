"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { getCurrencySymbol } from "@/lib/utils"

function ApplyPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('dashboard')
  const tApplication = useTranslations('application')
  const tCommon = useTranslations('common')
  const tProperty = useTranslations('property')
  const currencySymbol = getCurrencySymbol()
  const propertyId = searchParams.get("propertyId")
  const [property, setProperty] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    monthlyIncome: "",
    creditScore: "",
    depositAmount: "",
    message: "",
  })

  useEffect(() => {
    if (propertyId) {
      fetchProperty()
    } else {
      toast({
        title: tCommon('error'),
        description: t('propertyIdRequired') || "Property ID is required",
        variant: "destructive",
      })
      router.push("/dashboard/tenant")
    }
  }, [propertyId])

  const fetchProperty = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) {
        router.push("/auth/login")
        return
      }

      const response = await fetch(`/api/properties/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setProperty(data.property)
        setFormData(prev => ({
          ...prev,
          depositAmount: data.property.deposit?.toString() || "",
        }))
      } else {
        throw new Error("Failed to fetch property")
      }
    } catch (error: any) {
      toast({
        title: tCommon('error'),
        description: error.message || t('loadPropertyFailed') || "Failed to load property",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const token = localStorage.getItem("auth-token")
    if (!token) {
      toast({
        title: tCommon('error'),
        description: t('loginToApply') || "You need to login to apply",
        variant: "destructive",
      })
      router.push("/auth/login")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          propertyId,
          monthlyIncome: formData.monthlyIncome ? parseFloat(formData.monthlyIncome) : null,
          creditScore: formData.creditScore ? parseInt(formData.creditScore) : null,
          depositAmount: formData.depositAmount ? parseFloat(formData.depositAmount) : property.deposit,
          message: formData.message,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        toast({
          title: tCommon('success'),
          description: t('applicationSubmitted') || "Your application has been submitted successfully",
        })
        router.push("/dashboard/tenant/applications")
      } else {
        throw new Error(data.error || t('submitApplicationFailed') || "Failed to submit application")
      }
    } catch (error: any) {
      toast({
        title: tCommon('error'),
        description: error.message || tCommon('error'),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (!property) {
    return (
      <DashboardLayout userType="tenant">
        <div className="text-center py-12">{tCommon('loading')}</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout userType="tenant">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('applyForProperty') || "Apply for Property"}</h1>
          <p className="text-muted-foreground">{t('submitRentalApplication') || "Submit your rental application"}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{property.title}</CardTitle>
            <CardDescription>
              {property.address}, {property.city}, {property.state}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthlyIncome">{t('monthlyIncome') || "Monthly Income"} ({currencySymbol})</Label>
                  <Input
                    id="monthlyIncome"
                    type="number"
                    value={formData.monthlyIncome}
                    onChange={(e) => setFormData({ ...formData, monthlyIncome: e.target.value })}
                    placeholder={t('monthlyIncomePlaceholder') || "e.g. 8500"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="creditScore">{t('creditScore') || "Credit Score"}</Label>
                  <Input
                    id="creditScore"
                    type="number"
                    value={formData.creditScore}
                    onChange={(e) => setFormData({ ...formData, creditScore: e.target.value })}
                    placeholder={t('creditScorePlaceholder') || "e.g. 750"}
                    min="300"
                    max="850"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="depositAmount">{tProperty('deposit')} ({currencySymbol})</Label>
                <Input
                  id="depositAmount"
                  type="number"
                  value={formData.depositAmount}
                  onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">{t('messageToLandlord') || "Message to Landlord"}</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder={t('messageToLandlordPlaceholder') || "Tell the landlord why you're a good fit for this property..."}
                  rows={5}
                />
              </div>

              <div className="flex space-x-4">
                <Button type="submit" disabled={loading}>
                  {loading ? tCommon('loading') : (process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '提交' : 'Submit')}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  {tCommon('cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

export default function ApplyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-muted/30"><div className="text-center">Loading...</div></div>}>
      <ApplyPageContent />
    </Suspense>
  )
}
