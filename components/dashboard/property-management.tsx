"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PropertyCard } from "./property-card"
import { Plus, Filter, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export function PropertyManagement() {
  const router = useRouter()
  const t = useTranslations('property')
  const tCommon = useTranslations('common')
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProperties()
  }, [])

  const fetchProperties = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("auth-token")
      if (!token) {
        console.warn("No auth token found")
        setLoading(false)
        return
      }

      const response = await fetch("/api/properties", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("Failed to fetch properties:", response.status, errorData)
        setProperties([])
        setLoading(false)
        return
      }

      const data = await response.json()
      console.log("Properties data received:", data)
      let propertiesSource = data.properties || []
      if (propertiesSource.length === 0) {
        const userStr = localStorage.getItem("user")
        if (userStr) {
          try {
            const parsedUser = JSON.parse(userStr)
            const fallbackLandlordId = parsedUser?.id || parsedUser?.userId
            if (fallbackLandlordId) {
              const fallbackRes = await fetch(`/api/properties?landlordId=${fallbackLandlordId}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (fallbackRes.ok) {
                const fallbackData = await fallbackRes.json().catch(() => ({}))
                propertiesSource = fallbackData.properties || []
              }
            }
          } catch {}
        }
      }

      const formattedProperties = (propertiesSource || []).map((p: any) => ({
        id: p.id,
        title: p.title || 'Untitled Property',
        location: p.city && p.state ? `${p.city}, ${p.state}` : (p.address || 'Location not specified'),
        price: p.price || 0,
        beds: p.bedrooms || 0,
        baths: p.bathrooms || 0,
        sqft: p.sqft || 0,
        image: typeof p.images === 'string' 
          ? (() => {
              try {
                const parsed = JSON.parse(p.images)
                return Array.isArray(parsed) ? (parsed[0] || '/placeholder.svg') : '/placeholder.svg'
              } catch {
                return '/placeholder.svg'
              }
            })()
          : (Array.isArray(p.images) ? (p.images[0] || '/placeholder.svg') : '/placeholder.svg'),
        status: (p.status?.toLowerCase() || 'available'),
      }))
      
      console.log(`Formatted ${formattedProperties.length} properties`)
      setProperties(formattedProperties)
    } catch (error) {
      console.error("Failed to fetch properties:", error)
      setProperties([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{t('title')}</CardTitle>
              <CardDescription>{t('noPropertiesDesc')}</CardDescription>
            </div>
            <Button onClick={() => router.push("/dashboard/landlord/add-property")}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addProperty')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{tCommon('loading')}</div>
          ) : properties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <div key={property.id} className="space-y-3">
                  <PropertyCard property={property} showSaveButton={false} showManagementActions={true} />
                  <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{t('status')}:</span>
                      <Badge
                        variant={
                          property.status === "occupied"
                            ? "default"
                            : property.status === "available"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {t(property.status?.toLowerCase()) || property.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t('noProperties')}. {t('noPropertiesDesc')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
