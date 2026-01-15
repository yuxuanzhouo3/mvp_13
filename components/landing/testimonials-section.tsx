import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Star } from "lucide-react"

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Tenant",
    avatar: "/placeholder.svg?height=40&width=40",
    rating: 5,
    content:
      "RentGuard made finding my apartment so easy and secure. The deposit protection gave me peace of mind throughout the entire process.",
  },
  {
    name: "Michael Chen",
    role: "Landlord",
    avatar: "/placeholder.svg?height=40&width=40",
    rating: 5,
    content:
      "As a property owner, I love how RentGuard handles everything from tenant screening to secure payments. It has simplified my rental business.",
  },
  {
    name: "Emily Rodriguez",
    role: "Tenant",
    avatar: "/placeholder.svg?height=40&width=40",
    rating: 5,
    content:
      "The dispute resolution service was fantastic when I had an issue with my previous landlord. Professional and fair mediation.",
  },
]

export function TestimonialsSection() {
  return (
    <section className="py-20 lg:py-32">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Trusted by Thousands</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            See what our users say about their experience with RentGuard.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>

                <p className="text-muted-foreground mb-6 italic">"{testimonial.content}"</p>

                <div className="flex items-center">
                  <Avatar className="h-10 w-10 mr-3">
                    <AvatarImage src={testimonial.avatar || "/placeholder.svg"} alt={testimonial.name} />
                    <AvatarFallback>
                      {testimonial.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
