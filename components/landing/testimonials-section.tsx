"use client"

import { useState, useEffect } from "react"
import { useTranslations } from 'next-intl'
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Star } from "lucide-react"

interface Testimonial {
  id: string
  name: string
  role: string
  avatar?: string
  rating: number
  content: string
}

export function TestimonialsSection() {
  const t = useTranslations('landing')
  const tCommon = useTranslations('common')
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTestimonials()
  }, [])

  const fetchTestimonials = async () => {
    try {
      const response = await fetch("/api/testimonials")
      if (response.ok) {
        const data = await response.json()
        setTestimonials(data.testimonials || [])
      }
    } catch (error) {
      console.error("Failed to fetch testimonials:", error)
    } finally {
      setLoading(false)
    }
  }

  // If no testimonials, don't render the section
  if (!loading && testimonials.length === 0) {
    return null
  }

  return (
    <section className="py-20 lg:py-32">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('trustedByThousands')}</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t('trustedByThousandsDesc')}
          </p>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground">{tCommon('loading')}</div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.id} className="border-0 shadow-lg">
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
        )}
      </div>
    </section>
  )
}
