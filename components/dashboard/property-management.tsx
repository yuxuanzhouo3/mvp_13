"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PropertyCard } from "./property-card"
import { Plus, Filter, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export function PropertyManagement() {
  const router = useRouter()
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProperties()
  }, [])

  const fetchProperties = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch("/api/properties", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        const formattedProperties = (data.properties || []).map((p: any) => ({
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
          status: p.status?.toLowerCase() || 'available',
        }))
        setProperties(formattedProperties)
      }
    } catch (error) {
      console.error("Failed to fetch properties:", error)
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
              <CardTitle>Property Portfolio</CardTitle>
              <CardDescription>Manage all your rental properties</CardDescription>
            </div>
            <Button onClick={() => router.push("/dashboard/landlord/add-property")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Property
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading properties...</div>
          ) : properties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <div key={property.id} className="space-y-3">
                  <PropertyCard property={property} showSaveButton={false} showManagementActions={true} />
                  <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Status:</span>
                      <Badge
                        variant={
                          property.status === "occupied"
                            ? "default"
                            : property.status === "available"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {property.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No properties yet. Click "Add Property" to create your first property.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
