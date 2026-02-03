import { Header } from "@/components/layout/header"
import { HeroSection } from "@/components/landing/hero-section"
import { FeaturesSection } from "@/components/landing/features-section"
import { TestimonialsSection } from "@/components/landing/testimonials-section"
import { FeaturedListings } from "@/components/landing/featured-listings"
import { Footer } from "@/components/layout/footer"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <FeaturesSection />
        <FeaturedListings />
        <TestimonialsSection />
      </main>
      <Footer />
    </div>
  )
}
