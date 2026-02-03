"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

export default function ApplyPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
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
        title: "Error",
        description: "Property ID is required",
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
        title: "Error",
        description: error.message || "Failed to load property",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const token = localStorage.getItem("auth-token")
    if (!token) {
      toast({
        title: "Please login",
        description: "You need to login to apply",
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
          title: "Application submitted",
          description: "Your application has been submitted successfully",
        })
        router.push("/dashboard/tenant/applications")
      } else {
        throw new Error(data.error || "Failed to submit application")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit application",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (!property) {
    return (
      <DashboardLayout userType="tenant">
        <div className="text-center py-12">Loading property information...</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout userType="tenant">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Apply for Property</h1>
          <p className="text-muted-foreground">Submit your rental application</p>
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
                  <Label htmlFor="monthlyIncome">Monthly Income ($)</Label>
                  <Input
                    id="monthlyIncome"
                    type="number"
                    value={formData.monthlyIncome}
                    onChange={(e) => setFormData({ ...formData, monthlyIncome: e.target.value })}
                    placeholder="e.g. 8500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="creditScore">Credit Score</Label>
                  <Input
                    id="creditScore"
                    type="number"
                    value={formData.creditScore}
                    onChange={(e) => setFormData({ ...formData, creditScore: e.target.value })}
                    placeholder="e.g. 750"
                    min="300"
                    max="850"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="depositAmount">Deposit Amount ($)</Label>
                <Input
                  id="depositAmount"
                  type="number"
                  value={formData.depositAmount}
                  onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message to Landlord</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Tell the landlord why you're a good fit for this property..."
                  rows={5}
                />
              </div>

              <div className="flex space-x-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Submitting..." : "Submit Application"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
