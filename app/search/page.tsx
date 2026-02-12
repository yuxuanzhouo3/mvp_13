"use client"

import { Suspense } from "react"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from 'next-intl'
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, MapPin } from "lucide-react"
import { PropertyCard } from "@/components/dashboard/property-card"
import { useToast } from "@/hooks/use-toast"

function SearchContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const t = useTranslations('search')
  const tCommon = useTranslations('common')
  const tHero = useTranslations('hero')
  const [searchQuery, setSearchQuery] = useState("")
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = searchParams.get("q")
    if (q) {
      setSearchQuery(q)
      performSearch(q)
    }
  }, [searchParams])

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem("auth-token")
      const response = await fetch("/api/properties/search?" + new URLSearchParams({
        city: query,
      }), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      const data = await response.json()
      if (response.ok) {
        setProperties(data.properties || [])
      } else {
        throw new Error(data.error || t('searchFailed'))
      }
    } catch (error: any) {
      toast({
        title: t('searchFailed'),
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: t('enterSearchContent'),
        description: t('enterSearchContent'),
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem("auth-token")
      const searchParams = new URLSearchParams({
        city: searchQuery.trim(),
      })
      
      console.log('Searching with city:', searchQuery.trim())
      
      const response = await fetch(`/api/properties/search?${searchParams.toString()}`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: t('searchFailed') }))
        throw new Error(errorData.error || `${t('searchFailed')}: ${response.status}`)
      }

      const data = await response.json()
      console.log('Search results:', data)
      
      setProperties(data.properties || [])
      
      if (data.properties && data.properties.length === 0) {
        toast({
          title: t('noPropertiesFound'),
          description: t('noPropertiesFound'),
        })
      } else {
        toast({
          title: tCommon('success'),
          description: t('foundCount', { count: data.properties?.length || 0 }),
        })
      }
    } catch (error: any) {
      console.error('Search error:', error)
      toast({
        title: t('searchFailed'),
        description: error.message || t('searchFailed'),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-12">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={tHero('searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <Button onClick={handleSearch} disabled={loading}>
                  <Search className="mr-2 h-4 w-4" />
                  {loading ? tCommon('loading') : tCommon('search')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {loading && (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">{tCommon('loading')}</p>
              </CardContent>
            </Card>
          )}

          {properties.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                (() => {
                  const normalizedId = String(
                    property?.id ??
                      property?._id ??
                      property?.propertyId ??
                      property?.property_id ??
                      ''
                  )
                  return (
                <PropertyCard 
                  key={normalizedId} 
                  property={{
                    id: normalizedId,
                    title: property.title,
                    location: `${property.city || ''}${property.state ? `, ${property.state}` : ''}`.trim(),
                    price: property.price,
                    beds: property.bedrooms,
                    baths: property.bathrooms,
                    sqft: property.sqft || 0,
                    image: typeof property.images === 'string' 
                      ? (JSON.parse(property.images)?.[0] || '/placeholder.svg')
                      : (property.images?.[0] || '/placeholder.svg'),
                    status: property.status?.toLowerCase(),
                  }} 
                />
                  )
                })()
              ))}
            </div>
          )}

          {properties.length === 0 && !loading && (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">{t('noPropertiesFound')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div />}>
      <SearchContent />
    </Suspense>
  )
}
