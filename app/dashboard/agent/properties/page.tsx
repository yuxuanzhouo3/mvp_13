"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { PropertyCard } from "@/components/dashboard/property-card"
import { Search, Filter, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function AgentPropertiesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const tProperty = useTranslations('property')
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchProperties()
  }, [])

  const fetchProperties = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch("/api/agent/properties", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setProperties(data.properties || [])
      }
    } catch (error) {
      console.error("Failed to fetch properties:", error)
      toast({
        title: tCommon('error'),
        description: t('loadPropertiesFailed') || "Failed to load properties",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredProperties = properties.filter(property =>
    property.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    property.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    property.address?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <DashboardLayout userType="agent">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t('managedProperties')}</h1>
            <p className="text-muted-foreground">{t('propertiesUnderYourManagement')}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>{t('propertyPortfolio') || "Property Portfolio"}</CardTitle>
                <CardDescription>{t('searchAndManageListings') || "Search and manage your property listings"}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('searchProperties') || "Search properties..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                {tCommon('filter') || "Filter"}
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{tCommon('loading')}</div>
            ) : filteredProperties.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProperties.map((property: any) => (
                  <PropertyCard
                    key={property.id}
                    property={{
                      id: property.id,
                      title: property.title,
                      location: `${property.city}, ${property.state}`,
                      price: property.price,
                      beds: property.bedrooms,
                      baths: property.bathrooms,
                      sqft: property.sqft || 0,
                      image: typeof property.images === 'string'
                        ? (JSON.parse(property.images)?.[0] || '/placeholder.svg')
                        : (property.images?.[0] || '/placeholder.svg'),
                      status: property.status?.toLowerCase() || 'available',
                    }}
                    showSaveButton={false}
                    showManagementActions={true}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>{t('noPropertiesFound') || "No properties found"}</p>
                <p className="text-sm mt-2">{t('connectWithLandlords') || "Connect with landlords to manage their properties"}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
