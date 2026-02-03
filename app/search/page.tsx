"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, MapPin } from "lucide-react"
import { PropertyCard } from "@/components/dashboard/property-card"
import { useToast } from "@/hooks/use-toast"

export default function SearchPage() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
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
        throw new Error(data.error || "搜索失败")
      }
    } catch (error: any) {
      toast({
        title: "搜索失败",
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
        title: "请输入搜索内容",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem("auth-token")
      const response = await fetch("/api/properties/search?" + new URLSearchParams({
        city: searchQuery,
      }), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      const data = await response.json()
      if (response.ok) {
        setProperties(data.properties || [])
      } else {
        throw new Error(data.error || "搜索失败")
      }
    } catch (error: any) {
      toast({
        title: "搜索失败",
        description: error.message,
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
            <h1 className="text-3xl font-bold">Search Properties</h1>
            <p className="text-muted-foreground">Find your ideal home</p>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Enter city, neighborhood, or address"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <Button onClick={() => handleSearch()} disabled={loading}>
                  <Search className="mr-2 h-4 w-4" />
                  {loading ? "搜索中..." : "Search"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {properties.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
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
                    status: property.status?.toLowerCase(),
                  }} 
                />
              ))}
            </div>
          )}

          {properties.length === 0 && !loading && (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">No properties found. Try a different search.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
