"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Heart, MapPin, Bed, Bath, Square, Eye, MessageSquare } from "lucide-react"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from 'next-intl'
import { getCurrencySymbol } from "@/lib/utils"

interface Property {
  id: string | number
  title: string
  location: string
  price: number
  beds: number
  baths: number
  sqft: number
  image: string
  status?: string
}

interface PropertyCardProps {
  property: Property
  showSaveButton?: boolean
  showManagementActions?: boolean
}

export function PropertyCard({ property, showSaveButton = true, showManagementActions = false }: PropertyCardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('dashboard')
  const tProperty = useTranslations('property')
  const currencySymbol = getCurrencySymbol()
  const tCommon = useTranslations('common')
  const [isSaved, setIsSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Check if property is saved
    const checkSaved = async () => {
      const token = localStorage.getItem("auth-token")
      if (!token || !showSaveButton) return

      try {
        const response = await fetch("/api/saved-properties", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.ok) {
          const data = await response.json()
          const saved = data.properties?.some((p: any) => p.id === property.id || p.id === String(property.id))
          setIsSaved(saved)
        }
      } catch (error) {
        // Silent fail
      }
    }
    checkSaved()
  }, [property.id, showSaveButton])

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const token = localStorage.getItem("auth-token")
    if (!token) {
      toast({
        title: tCommon('error'),
        description: t('loginToAddProperties') || "You need to login to save properties",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      if (isSaved) {
        // Remove from saved
        const response = await fetch(`/api/saved-properties?propertyId=${property.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.ok) {
          setIsSaved(false)
          toast({
            title: tCommon('success'),
            description: t('removedFromSaved') || "Property removed from saved list",
          })
        }
      } else {
        // Add to saved
        const response = await fetch("/api/saved-properties", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ propertyId: property.id }),
        })
        if (response.ok) {
          setIsSaved(true)
          toast({
            title: tCommon('success'),
            description: t('addedToSaved') || "Property added to saved list",
          })
        } else {
          const data = await response.json()
          throw new Error(data.error || (t('savePropertyFailed') || "Failed to save property"))
        }
      }
    } catch (error: any) {
      toast({
        title: tCommon('error'),
        description: error.message || (t('savePropertyFailed') || "Failed to save property"),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleViewDetails = () => {
    const userStr = localStorage.getItem("user")
    if (userStr) {
      const user = JSON.parse(userStr)
      if (user.userType === "TENANT") {
        router.push(`/dashboard/tenant/property/${property.id}`)
        return
      } else if (user.userType === "LANDLORD") {
        router.push(`/dashboard/landlord/properties/${property.id}`)
        return
      } else if (user.userType === "AGENT") {
        router.push(`/dashboard/agent/properties/${property.id}`)
        return
      }
    }
    router.push(`/properties/${property.id}`)
  }

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative">
        <Image
          src={property.image || "/placeholder.svg"}
          alt={property.title}
          width={300}
          height={200}
          className="w-full h-48 object-cover"
        />
        {showSaveButton && (
          <Button 
            size="icon" 
            variant="ghost" 
            className={`absolute top-2 right-2 bg-background/80 hover:bg-background ${isSaved ? 'text-red-500' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            <Heart className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
          </Button>
        )}
        {property.status && (
          <Badge className="absolute top-2 left-2" variant={property.status === "available" ? "default" : "secondary"}>
            {property.status}
          </Badge>
        )}
      </div>

      <CardContent className="p-4 flex flex-col h-[200px]">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-lg line-clamp-1 flex-1 mr-2" title={property.title}>{property.title}</h3>
          <span className="text-xl font-bold text-primary whitespace-nowrap">
            {currencySymbol}{property.price.toLocaleString()}
            <span className="text-sm font-normal text-muted-foreground">/mo</span>
          </span>
        </div>

        <div className="flex items-center text-muted-foreground mb-3">
          <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
          <span className="text-sm line-clamp-1" title={property.location}>{property.location}</span>
        </div>

        <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center whitespace-nowrap">
            <Bed className="h-4 w-4 mr-1" />
            {property.beds} {tProperty('bedrooms')}
          </div>
          <div className="flex items-center whitespace-nowrap">
            <Bath className="h-4 w-4 mr-1" />
            {property.baths} {tProperty('bathrooms')}
          </div>
          <div className="flex items-center whitespace-nowrap">
            <Square className="h-4 w-4 mr-1" />
            {property.sqft} {tProperty('sqft') || tProperty('buildingArea')}
          </div>
        </div>

        <div className="mt-auto">

        {showManagementActions ? (
            <div className="flex space-x-2">
              <Button size="sm" variant="outline" className="flex-1 bg-transparent" onClick={handleViewDetails}>
                <Eye className="mr-2 h-4 w-4" />
                {tCommon('view') || t('viewDetails')}
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 bg-transparent"
                onClick={async () => {
                  const token = localStorage.getItem("auth-token")
                  if (!token) {
                    toast({
                      title: tCommon('error'),
                      description: t('noMessagesYet') || "You need to login to send messages",
                      variant: "destructive",
                    })
                    router.push("/auth/login")
                    return
                  }
                  
                  try {
                    // Fetch property to get landlord ID
                    const res = await fetch(`/api/properties/${property.id}`, {
                      headers: { Authorization: `Bearer ${token}` },
                    })
                    const data = await res.json()
                    
                    const userStr = localStorage.getItem("user")
                    const user = userStr ? JSON.parse(userStr) : null
                    
                    // Determine the correct dashboard path based on user type
                    let dashboardPath = "tenant"
                    if (user?.userType === "LANDLORD") {
                      dashboardPath = "landlord"
                    } else if (user?.userType === "AGENT") {
                      dashboardPath = "agent"
                    }
                    
                    if (user?.userType === "AGENT") {
                      if (data.property?.landlord?.id) {
                        router.push(`/dashboard/agent/messages?userId=${data.property.landlord.id}`)
                      } else {
                        router.push(`/dashboard/agent/messages`)
                      }
                    } else if (showManagementActions) {
                      // For landlords managing properties, go to messages center
                      router.push(`/dashboard/${dashboardPath}/messages`)
                    } else if (data.property?.landlord?.id) {
                      // For tenants, go to landlord conversation
                      router.push(`/dashboard/${dashboardPath}/messages?userId=${data.property.landlord.id}`)
                    } else {
                      throw new Error("Property landlord not found")
                    }
                  } catch (error: any) {
                    toast({
                      title: tCommon('error'),
                      description: error.message || (t('loadPropertyFailed') || "Failed to load property information"),
                      variant: "destructive",
                    })
                  }
                }}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                {t('messages')}
              </Button>
            </div>
          ) : (
            <Button className="w-full" onClick={handleViewDetails}>{t('viewDetails') || tCommon('view')}</Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
