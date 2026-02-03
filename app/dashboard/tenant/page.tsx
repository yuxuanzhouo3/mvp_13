"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, MapPin, Filter, Heart, Calendar, MessageSquare } from "lucide-react"
import { PropertyCard } from "@/components/dashboard/property-card"
import { PaymentHistory } from "@/components/dashboard/payment-history"
import { MessageCenter } from "@/components/dashboard/message-center"
import { AIChat } from "@/components/dashboard/ai-chat"


export default function TenantDashboard() {
  const [searchQuery, setSearchQuery] = useState("")
  const [savedProperties, setSavedProperties] = useState<any[]>([])
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [stats, setStats] = useState({
    savedCount: 0,
    applicationsCount: 0,
    viewingsCount: 0,
    unreadMessages: 0,
  })
  const [userName, setUserName] = useState("")

  // Fetch user data and stats
  const fetchData = async () => {
    const token = localStorage.getItem("auth-token")
    if (!token) return

    try {
      // Get user info
      const userStr = localStorage.getItem("user")
      if (userStr) {
        const user = JSON.parse(userStr)
        setUserName(user.name || "User")
      }

      // Fetch saved properties
      const savedRes = await fetch("/api/saved-properties", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (savedRes.ok) {
        const savedData = await savedRes.json()
        setSavedProperties(savedData.properties || [])
        setStats(prev => ({ ...prev, savedCount: savedData.properties?.length || 0 }))
      }

      // Fetch applications
      const appsRes = await fetch("/api/applications?userType=tenant", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (appsRes.ok) {
        const appsData = await appsRes.json()
        setApplications(appsData.applications || [])
        setStats(prev => ({ ...prev, applicationsCount: appsData.applications?.length || 0 }))
      }

      // Fetch unread messages count
      const messagesRes = await fetch("/api/messages/unread-count", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (messagesRes.ok) {
        const messagesData = await messagesRes.json()
        setStats(prev => ({ ...prev, unreadMessages: messagesData.count || 0 }))
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
    }
  }

  useEffect(() => {
    fetchData()
    // Refresh saved properties when tab changes
    const interval = setInterval(() => {
      fetchData()
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <DashboardLayout userType="tenant">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {userName || "User"}!</h1>
          <p className="text-muted-foreground">Find your ideal home with secure deposit protection.</p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Search className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">Search Properties</div>
                  <div className="text-sm text-muted-foreground">Find your next home</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Heart className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">Saved Properties</div>
                  <div className="text-sm text-muted-foreground">{stats.savedCount} saved</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">Viewings</div>
                  <div className="text-sm text-muted-foreground">{stats.viewingsCount} scheduled</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">Messages</div>
                  <div className="text-sm text-muted-foreground">{stats.unreadMessages} unread</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="ai-search" className="space-y-6">
          <TabsList>
            <TabsTrigger value="ai-search">AI Smart Search</TabsTrigger>
            <TabsTrigger value="search">Search Properties</TabsTrigger>
            <TabsTrigger value="saved">Saved Properties</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
          </TabsList>

          <TabsContent value="ai-search" className="space-y-6">
            <AIChat userType="tenant" />
          </TabsContent>

          <TabsContent value="search" className="space-y-6">
            {/* Search Bar */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter city, neighborhood, or address"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline">
                    <Filter className="mr-2 h-4 w-4" />
                    Filters
                  </Button>
                  <Button onClick={async () => {
                    if (!searchQuery.trim()) {
                      alert("Please enter search content")
                      return
                    }
                    const token = localStorage.getItem("auth-token")
                    try {
                      const response = await fetch(`/api/properties/search?city=${encodeURIComponent(searchQuery)}`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {}
                      })
                      const data = await response.json()
                      if (data.properties) {
                        setSearchResults(data.properties.map((p: any) => ({
                          id: p.id,
                          title: p.title,
                          location: `${p.city}, ${p.state}`,
                          price: p.price,
                          beds: p.bedrooms,
                          baths: p.bathrooms,
                          sqft: p.sqft || 0,
                          image: typeof p.images === 'string' ? (JSON.parse(p.images)?.[0] || '/placeholder.svg') : (p.images?.[0] || '/placeholder.svg'),
                          status: 'available',
                        })))
                      }
                    } catch (err) {
                      console.error(err)
                      alert("Search failed, please try again later")
                    }
                  }}>
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Search Results */}
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {searchResults.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">Enter search criteria and click search to find properties</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="saved" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Saved Properties</CardTitle>
                <CardDescription>Properties you've saved for later</CardDescription>
              </CardHeader>
              <CardContent>
                {savedProperties.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {savedProperties.map((property) => (
                      <PropertyCard key={property.id} property={property} showSaveButton={false} />
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No saved properties yet. Start searching and save your favorites!</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Rental Applications</CardTitle>
                <CardDescription>Track your application status</CardDescription>
              </CardHeader>
              <CardContent>
                {applications.length > 0 ? (
                  <div className="space-y-4">
                    {applications.map((application) => (
                      <div key={application.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-semibold">{application.property?.title || "Property"}</div>
                          <div className="text-sm text-muted-foreground">
                            Applied on {new Date(application.appliedDate).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Deposit: ${application.depositAmount?.toLocaleString() || 0}
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={application.status === "APPROVED" ? "default" : "secondary"}>
                            {application.status?.replace("_", " ").toLowerCase() || "pending"}
                          </Badge>
                          <div className="mt-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => window.location.href = `/properties/${application.propertyId}`}
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No applications yet. Start applying to properties!</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <PaymentHistory userType="tenant" />
          </TabsContent>

          <TabsContent value="messages">
            <MessageCenter />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
