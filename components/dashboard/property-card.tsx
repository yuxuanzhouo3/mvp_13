import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Heart, MapPin, Bed, Bath, Square, Eye, MessageSquare } from "lucide-react"
import Image from "next/image"

interface Property {
  id: number
  title: string
  location: string
  price: number
  beds: number
  baths: number
  sqft: number
  image: string
  status?: string
}

interface PropertyCardProps {
  property: Property
  showSaveButton?: boolean
  showManagementActions?: boolean
}

export function PropertyCard({ property, showSaveButton = true, showManagementActions = false }: PropertyCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative">
        <Image
          src={property.image || "/placeholder.svg"}
          alt={property.title}
          width={300}
          height={200}
          className="w-full h-48 object-cover"
        />
        {showSaveButton && (
          <Button size="icon" variant="ghost" className="absolute top-2 right-2 bg-background/80 hover:bg-background">
            <Heart className="h-4 w-4" />
          </Button>
        )}
        {property.status && (
          <Badge className="absolute top-2 left-2" variant={property.status === "available" ? "default" : "secondary"}>
            {property.status}
          </Badge>
        )}
      </div>

      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-lg">{property.title}</h3>
          <span className="text-xl font-bold text-primary">
            ${property.price.toLocaleString()}
            <span className="text-sm font-normal text-muted-foreground">/mo</span>
          </span>
        </div>

        <div className="flex items-center text-muted-foreground mb-3">
          <MapPin className="h-4 w-4 mr-1" />
          <span className="text-sm">{property.location}</span>
        </div>

        <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center">
            <Bed className="h-4 w-4 mr-1" />
            {property.beds} bed{property.beds > 1 ? "s" : ""}
          </div>
          <div className="flex items-center">
            <Bath className="h-4 w-4 mr-1" />
            {property.baths} bath{property.baths > 1 ? "s" : ""}
          </div>
          <div className="flex items-center">
            <Square className="h-4 w-4 mr-1" />
            {property.sqft} sqft
          </div>
        </div>

        {showManagementActions ? (
          <div className="flex space-x-2">
            <Button size="sm" variant="outline" className="flex-1 bg-transparent">
              <Eye className="mr-2 h-4 w-4" />
              View
            </Button>
            <Button size="sm" variant="outline" className="flex-1 bg-transparent">
              <MessageSquare className="mr-2 h-4 w-4" />
              Messages
            </Button>
          </div>
        ) : (
          <Button className="w-full">View Details</Button>
        )}
      </CardContent>
    </Card>
  )
}
