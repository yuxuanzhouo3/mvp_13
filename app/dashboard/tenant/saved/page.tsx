"use client"

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { PropertyCard } from "@/components/dashboard/property-card"
import { useState, useEffect } from "react"

export default function SavedPropertiesPage() {
  const [savedProperties, setSavedProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSavedProperties = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch("/api/saved-properties", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setSavedProperties(data.properties || [])
      }
    } catch (error) {
      console.error("Failed to fetch saved properties:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSavedProperties()
    const interval = setInterval(fetchSavedProperties, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <DashboardLayout userType="tenant">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Saved Properties</h1>
          <p className="text-muted-foreground">Properties you've saved for later</p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        ) : savedProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedProperties.map((property) => (
              <PropertyCard key={property.id} property={property} showSaveButton={false} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No saved properties yet. Start searching and save your favorites!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
