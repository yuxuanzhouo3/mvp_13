"use client"

import { Suspense } from "react"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, MapPin, Filter } from "lucide-react"
import { PropertyCard } from "@/components/dashboard/property-card"
import { useToast } from "@/hooks/use-toast"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { getPrimaryImage } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('search')
  const tCommon = useTranslations('common')
  const tHero = useTranslations('hero')
  const tProperty = useTranslations('property')
  
  const [searchQuery, setSearchQuery] = useState("")
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [minBedrooms, setMinBedrooms] = useState("0")
  const [minBathrooms, setMinBathrooms] = useState("0")
  const [petFriendly, setPetFriendly] = useState(false)
  
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const cleanText = (text: string) => {
    return text?.replace(/^(property\.|dashboard\.|common\.|application\.|payment\.)/i, '') || text
  }

  useEffect(() => {
    const token = localStorage.getItem("auth-token")
    const user = localStorage.getItem("user")
    if (!token || !user) {
      router.replace("/auth/login")
    }
  }, [router])

  useEffect(() => {
    const q = searchParams.get("q")
    const minP = searchParams.get("minPrice")
    const maxP = searchParams.get("maxPrice")
    const minBeds = searchParams.get("minBedrooms")
    const minBaths = searchParams.get("minBathrooms")
    const pet = searchParams.get("petFriendly")

    if (q) setSearchQuery(q)
    if (minP) setMinPrice(minP)
    if (maxP) setMaxPrice(maxP)
    if (minBeds) setMinBedrooms(minBeds)
    if (minBaths) setMinBathrooms(minBaths)
    if (pet) setPetFriendly(pet === 'true')

    // Always perform search if there are params, even if q is empty (e.g. only filters)
    if (searchParams.toString()) {
      performSearch(searchParams.toString())
    }
  }, [searchParams])

  const performSearch = async (queryString: string) => {
    setLoading(true)
    try {
      const token = localStorage.getItem("auth-token")
      
      const response = await fetch("/api/properties/search?" + queryString, {
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
    setLoading(true)
    try {
      const params = new URLSearchParams()
      
      if (searchQuery.trim()) params.set('q', searchQuery.trim())
      if (minPrice) params.set('minPrice', minPrice)
      if (maxPrice) params.set('maxPrice', maxPrice)
      if (minBedrooms && minBedrooms !== "0") params.set('minBedrooms', minBedrooms)
      if (minBathrooms && minBathrooms !== "0") params.set('minBathrooms', minBathrooms)
      if (petFriendly) params.set('petFriendly', 'true')
      
      console.log('Searching with params:', params.toString())
      
      // Update URL without reloading
      router.push(`/search?${params.toString()}`)
      
      // Perform search directly
      await performSearch(params.toString())
      
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
            <h1 className="text-3xl font-bold">{cleanText(t('title'))}</h1>
            <p className="text-muted-foreground">{cleanText(t('subtitle'))}</p>
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={cleanText(tHero('searchPlaceholder'))}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setShowFilters(!showFilters)}
                  className={showFilters ? "bg-secondary" : ""}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  {cleanText(tCommon('filters') || "Filters")}
                </Button>
                <Button onClick={handleSearch} disabled={loading}>
                  <Search className="mr-2 h-4 w-4" />
                  {loading ? cleanText(tCommon('loading')) : cleanText(tCommon('search'))}
                </Button>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>{cleanText(tProperty('priceRange') || "Price Range")}</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="number" 
                        placeholder="Min" 
                        value={minPrice} 
                        onChange={(e) => setMinPrice(e.target.value)}
                      />
                      <span>-</span>
                      <Input 
                        type="number" 
                        placeholder="Max" 
                        value={maxPrice} 
                        onChange={(e) => setMaxPrice(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{cleanText(tProperty('bedrooms'))}</Label>
                    <Select value={minBedrooms} onValueChange={setMinBedrooms}>
                      <SelectTrigger>
                        <SelectValue placeholder={cleanText(tProperty('any') || "Any")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">{cleanText(tProperty('any') || "Any")}</SelectItem>
                        <SelectItem value="1">1+</SelectItem>
                        <SelectItem value="2">2+</SelectItem>
                        <SelectItem value="3">3+</SelectItem>
                        <SelectItem value="4">4+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{cleanText(tProperty('bathrooms'))}</Label>
                    <Select value={minBathrooms} onValueChange={setMinBathrooms}>
                      <SelectTrigger>
                        <SelectValue placeholder={cleanText(tProperty('any') || "Any")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">{cleanText(tProperty('any') || "Any")}</SelectItem>
                        <SelectItem value="1">1+</SelectItem>
                        <SelectItem value="2">2+</SelectItem>
                        <SelectItem value="3">3+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2 pt-8">
                    <Checkbox 
                      id="petFriendly" 
                      checked={petFriendly}
                      onCheckedChange={(checked) => setPetFriendly(checked as boolean)}
                    />
                    <Label htmlFor="petFriendly" className="cursor-pointer">
                      {cleanText(tProperty('petFriendly') || "Pet Friendly")}
                    </Label>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {loading && (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">{cleanText(tCommon('loading'))}</p>
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
                    image: getPrimaryImage(property.images ?? property.image),
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
                <p className="text-muted-foreground">{cleanText(t('noPropertiesFound'))}</p>
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
