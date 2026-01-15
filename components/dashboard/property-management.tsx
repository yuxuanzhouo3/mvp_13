import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PropertyCard } from "./property-card"
import { Plus, Filter, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

const properties = [
  {
    id: 1,
    title: "Modern Downtown Apartment",
    location: "Downtown, Seattle",
    price: 2800,
    beds: 2,
    baths: 2,
    sqft: 1200,
    image: "/placeholder.svg?height=200&width=300",
    status: "occupied",
    tenant: "Sarah Johnson",
    leaseEnd: "2024-12-31",
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
    status: "available",
    tenant: null,
    leaseEnd: null,
  },
  {
    id: 3,
    title: "Family House with Garden",
    location: "Ballard, Seattle",
    price: 4200,
    beds: 3,
    baths: 2,
    sqft: 1800,
    image: "/placeholder.svg?height=200&width=300",
    status: "maintenance",
    tenant: "Mike Wilson",
    leaseEnd: "2024-08-15",
  },
]

export function PropertyManagement() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Property Portfolio</CardTitle>
              <CardDescription>Manage all your rental properties</CardDescription>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Property
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Input placeholder="Search properties..." />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
            <Button variant="outline">
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>

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
                  {property.tenant && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Tenant:</span>
                      <span className="text-sm">{property.tenant}</span>
                    </div>
                  )}
                  {property.leaseEnd && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Lease End:</span>
                      <span className="text-sm">{new Date(property.leaseEnd).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
