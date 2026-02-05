"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Bed, Bath, Square, Heart } from "lucide-react"
import Image from "next/image"
import { PropertyCard } from "@/components/dashboard/property-card"

export function FeaturedListings() {
  const router = useRouter()
  const t = useTranslations('landing')
  const tCommon = useTranslations('common')
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFeaturedProperties()
  }, [])

  const fetchFeaturedProperties = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      const response = await fetch("/api/properties/search?limit=6", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (response.ok) {
        const data = await response.json()
        const formattedListings = (data.properties || []).map((p: any) => ({
          id: p.id,
          title: p.title,
          location: `${p.city}, ${p.state}`,
          price: p.price,
          beds: p.bedrooms,
          baths: p.bathrooms,
          sqft: p.sqft || 0,
          image: typeof p.images === 'string' 
            ? (JSON.parse(p.images)?.[0] || '/placeholder.svg')
            : (p.images?.[0] || '/placeholder.svg'),
          status: 'available',
        }))
        setListings(formattedListings)
      }
    } catch (error) {
      console.error("Failed to fetch featured properties:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="py-20 lg:py-32 bg-muted/30">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('featuredProperties')}</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t('featuredPropertiesDesc')}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">{tCommon('loading')}</div>
        ) : listings.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <PropertyCard key={listing.id} property={listing} />
              ))}
            </div>

            <div className="text-center mt-12">
              <Button variant="outline" size="lg" onClick={() => router.push("/search")}>
                {t('viewAllProperties')}
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {t('noPropertiesAvailable')}
          </div>
        )}
      </div>
    </section>
  )
}
