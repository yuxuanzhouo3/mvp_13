"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PropertyCard } from "./property-card"
import { Plus, Filter, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export function PropertyManagement({ userId }: { userId?: string }) {
  const router = useRouter()
  const t = useTranslations('property')
  const tCommon = useTranslations('common')
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  const cleanText = (text: string) => {
    if (!text) return ''
    return text.replace(/^(dashboard\.|property\.|common\.|application\.)/i, '')
  }

  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 15000) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }
  }

  const fetchProperties = useCallback(async () => {
    try {
      if (isMounted.current) setLoading(true)
      const token = localStorage.getItem("auth-token")
      if (!token) {
        console.warn("No auth token found")
        if (isMounted.current) setLoading(false)
        return
      }
      const userStr = localStorage.getItem("user")
      let parsedUser: any = null
      if (userStr) {
        try {
          parsedUser = JSON.parse(userStr)
        } catch {}
      }
      const headerBag: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      }
      
      // Use prop userId if available, otherwise fallback to localStorage
      const effectiveUserId = userId || parsedUser?.id || parsedUser?.userId || parsedUser?._id
      const hintedUserEmail = parsedUser?.email
      
      if (effectiveUserId) {
        headerBag["x-user-id"] = String(effectiveUserId)
      }
      if (hintedUserEmail) {
        headerBag["x-user-email"] = String(hintedUserEmail)
      }

      // If we don't have a user ID, we shouldn't fetch "all" properties as it causes a flash of unrelated data
      // and is a security risk. We must wait for the user ID to be available.
      if (!effectiveUserId) {
        if (isMounted.current) setLoading(false)
        return
      }

      // First try fetching properties directly - if landlord, try to filter by landlordId explicitly
      let url = "/api/properties"
      // Always filter by landlordId if we have it, to ensure we get ONLY this landlord's properties
      // and to avoid the "data appears then disappears" issue which might be caused by inconsistent queries
      if (effectiveUserId) {
        url = `/api/properties?landlordId=${effectiveUserId}`
      } else if (parsedUser && (parsedUser.userType === 'LANDLORD' || parsedUser.role === 'LANDLORD')) {
        const uid = parsedUser.id || parsedUser.userId
        if (uid) {
          url = `/api/properties?landlordId=${uid}`
        }
      }

      const response = await fetchWithTimeout(url, {
        headers: headerBag,
        credentials: "include",
        cache: "no-store",
      })

      if (!isMounted.current) return

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("Failed to fetch properties:", response.status, errorData)
        // If we already have properties and the fetch fails, keep the old ones to avoid flickering
        // Only set empty if we had nothing before, or if we want to explicitly clear on error
        if (properties.length === 0) {
           setProperties([])
        }
        if (isMounted.current) setLoading(false)
        return
      }

      const data = await response.json()
      console.log("Properties data received:", data)
      let propertiesSource = data.properties || data.data?.properties || data.data || []
      
      // Fallback: If specific query returned nothing, try general query
      // This handles cases where the ID might be mismatched in the specific query
      if (propertiesSource.length === 0 && url.includes('landlordId')) {
         try {
            console.log("Specific landlord query returned empty, trying general query...")
            const fallbackRes = await fetchWithTimeout(`/api/properties`, {
              headers: headerBag,
              credentials: "include",
              cache: "no-store",
            })
            if (fallbackRes.ok && isMounted.current) {
              const fallbackData = await fallbackRes.json().catch(() => ({}))
              const fallbackProps = fallbackData.properties || fallbackData.data?.properties || fallbackData.data || []
              if (fallbackProps.length > 0) {
                // Filter client-side to be safe
                if (effectiveUserId) {
                   const filtered = fallbackProps.filter((p: any) => 
                     String(p.landlordId || p.landlord_id || p.ownerId || p.owner_id || p.userId || p.user_id) === String(effectiveUserId)
                   )
                   // If filtered result is not empty, use it. Otherwise, keep empty (which is correct if user has no properties)
                   propertiesSource = filtered
                } else {
                   // If we don't have effectiveUserId (should be caught above), don't show anything
                   propertiesSource = []
                }
              }
            }
         } catch (e) {
            console.error("Fallback fetch failed:", e)
         }
      }

      if (!isMounted.current) return

      // Only update if we have data or if we are sure it's empty
      // If propertiesSource is empty but we previously had data, and the first fetch failed (wait, we handled failure above),
      // Here propertiesSource is empty means either user truly has no properties, OR the API returned empty incorrectly.
      // Given the user report "appears then disappears", it's likely the first fetch (or cache) had data, and this new fetch returns empty.
      // However, we can't distinguish "truly empty" from "api error returning empty 200 OK".
      // But if we use the fallback logic above, we reduce the chance of false empty.
      
      const formattedProperties = (propertiesSource || []).map((p: any) => ({
        id: p.id ?? p._id ?? p.propertyId ?? p.property_id,
        title: cleanText(p.title || 'Untitled Property'),
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
        status: cleanText(p.status?.toLowerCase() || 'available'),
      }))
      
      console.log(`Formatted ${formattedProperties.length} properties`)
      setProperties(formattedProperties)
    } catch (error) {
      if (isMounted.current) {
        console.error("Failed to fetch properties:", error)
        setProperties([])
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchProperties()
  }, [fetchProperties])

  // Helper to remove prefixes from status
  const getStatusLabel = (status: string) => {
    const cleanStatus = cleanText(status?.toLowerCase()) || 'available'
    return t(cleanStatus) || cleanStatus
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{cleanText(t('title'))}</CardTitle>
              <CardDescription>{cleanText(t('noPropertiesDesc'))}</CardDescription>
            </div>
            <Button onClick={() => router.push("/dashboard/landlord/add-property")}>
              <Plus className="mr-2 h-4 w-4" />
              {cleanText(t('addProperty'))}
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
                        {getStatusLabel(property.status)}
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
