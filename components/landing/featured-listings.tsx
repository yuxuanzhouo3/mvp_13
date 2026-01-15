import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Bed, Bath, Square, Heart } from "lucide-react"
import Image from "next/image"

const listings = [
  {
    id: 1,
    title: "Modern Downtown Apartment",
    location: "Downtown, Seattle",
    price: 2800,
    beds: 2,
    baths: 2,
    sqft: 1200,
    image: "/placeholder.svg?height=300&width=400",
    featured: true,
    verified: true,
  },
  {
    id: 2,
    title: "Cozy Studio in Capitol Hill",
    location: "Capitol Hill, Seattle",
    price: 1600,
    beds: 1,
    baths: 1,
    sqft: 650,
    image: "/placeholder.svg?height=300&width=400",
    featured: false,
    verified: true,
  },
  {
    id: 3,
    title: "Family House with Garden",
    location: "Ballard, Seattle",
    price: 4200,
    beds: 3,
    baths: 2,
    sqft: 1800,
    image: "/placeholder.svg?height=300&width=400",
    featured: true,
    verified: true,
  },
]

export function FeaturedListings() {
  return (
    <section className="py-20 lg:py-32 bg-muted/30">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Featured Properties</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Discover verified properties with secure deposit protection.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <Card key={listing.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative">
                <Image
                  src={listing.image || "/placeholder.svg"}
                  alt={listing.title}
                  width={400}
                  height={300}
                  className="w-full h-48 object-cover"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 bg-background/80 hover:bg-background"
                >
                  <Heart className="h-4 w-4" />
                </Button>
                {listing.featured && <Badge className="absolute top-2 left-2">Featured</Badge>}
                {listing.verified && (
                  <Badge variant="secondary" className="absolute bottom-2 left-2">
                    Verified
                  </Badge>
                )}
              </div>

              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-lg">{listing.title}</h3>
                  <span className="text-2xl font-bold text-primary">
                    ${listing.price.toLocaleString()}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </span>
                </div>

                <div className="flex items-center text-muted-foreground mb-4">
                  <MapPin className="h-4 w-4 mr-1" />
                  <span className="text-sm">{listing.location}</span>
                </div>

                <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center">
                    <Bed className="h-4 w-4 mr-1" />
                    {listing.beds} bed{listing.beds > 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center">
                    <Bath className="h-4 w-4 mr-1" />
                    {listing.baths} bath{listing.baths > 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center">
                    <Square className="h-4 w-4 mr-1" />
                    {listing.sqft} sqft
                  </div>
                </div>

                <Button className="w-full">View Details</Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button variant="outline" size="lg">
            View All Properties
          </Button>
        </div>
      </div>
    </section>
  )
}
