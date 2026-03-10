import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export default function PressPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container py-12 flex-1">
        <h1 className="text-4xl font-bold mb-6">Press & Media</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Latest news and updates from RentGuard.
        </p>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="border p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-2">RentGuard Raises Series A</h2>
            <p className="text-sm text-muted-foreground mb-4">October 24, 2023</p>
            <p>RentGuard secures $10M in funding to expand its deposit protection services.</p>
          </div>
          <div className="border p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-2">New Tenant Screening Features</h2>
            <p className="text-sm text-muted-foreground mb-4">August 15, 2023</p>
            <p>Introducing enhanced background checks for faster tenant approval.</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
