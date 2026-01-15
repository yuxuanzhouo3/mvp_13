"use client"

import { useState } from "react"
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

const savedProperties = [
  {
    id: 1,
    title: "Modern Downtown Apartment",
    location: "Downtown, Seattle",
    price: 2800,
    beds: 2,
    baths: 2,
    sqft: 1200,
    image: "/placeholder.svg?height=200&width=300",
    status: "available",
  },
  {
    id: 2,
    title: "Cozy Studio in Capitol Hill",
    location: "Capitol Hill, Seattle",
    price: 1600,
    beds: 1,
    baths: 1,
    sqft: 650,
    image: "/placeholder.svg?height=200&width=300",
    status: "pending",
  },
]

const applications = [
  {
    id: 1,
    property: "Modern Downtown Apartment",
    status: "under_review",
    appliedDate: "2024-01-15",
    depositAmount: 2800,
  },
  {
    id: 2,
    property: "Cozy Studio in Capitol Hill",
    status: "approved",
    appliedDate: "2024-01-10",
    depositAmount: 1600,
  },
]

export default function TenantDashboard() {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <DashboardLayout userType="tenant">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Welcome back, Sarah!</h1>
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
                  <div className="text-sm text-muted-foreground">{savedProperties.length} saved</div>
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
                  <div className="text-sm text-muted-foreground">2 scheduled</div>
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
                  <div className="text-sm text-muted-foreground">3 unread</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="search" className="space-y-6">
          <TabsList>
            <TabsTrigger value="search">Search Properties</TabsTrigger>
            <TabsTrigger value="saved">Saved Properties</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
          </TabsList>

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
                  <Button>
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Search Results */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedProperties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="saved" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Saved Properties</CardTitle>
                <CardDescription>Properties you've saved for later</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {savedProperties.map((property) => (
                    <PropertyCard key={property.id} property={property} showSaveButton={false} />
                  ))}
                </div>
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
                <div className="space-y-4">
                  {applications.map((application) => (
                    <div key={application.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-semibold">{application.property}</div>
                        <div className="text-sm text-muted-foreground">
                          Applied on {new Date(application.appliedDate).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Deposit: ${application.depositAmount.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={application.status === "approved" ? "default" : "secondary"}>
                          {application.status.replace("_", " ")}
                        </Badge>
                        <div className="mt-2">
                          <Button size="sm" variant="outline">
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
