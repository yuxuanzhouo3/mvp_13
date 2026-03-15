import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container py-12 flex-1">
        <h1 className="text-4xl font-bold mb-6">About Us</h1>
        <p className="text-lg text-muted-foreground mb-8">
          RentGuard is dedicated to making renting safer, easier, and more transparent for everyone.
        </p>
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
            <p className="mb-4">
              To revolutionize the rental market by providing secure deposit protection, streamlined property management, and trusted tenant screening.
            </p>
            <h2 className="text-2xl font-bold mb-4">Our Vision</h2>
            <p>
              A world where landlords and tenants can trust each other implicitly, supported by technology that protects both parties.
            </p>
          </div>
          <div className="bg-muted aspect-video rounded-lg flex items-center justify-center">
            <span className="text-muted-foreground">Team Photo Placeholder</span>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
