import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export default function RenterResourcesPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container py-12 flex-1">
        <h1 className="text-4xl font-bold mb-6">Renter Resources</h1>
        <p className="text-lg text-muted-foreground mb-4">
          Welcome to our Renter Resources center. Here you can find valuable information to help you navigate your renting journey.
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li>Understanding your lease agreement</li>
          <li>Rights and responsibilities as a tenant</li>
          <li>Tips for moving and settling in</li>
          <li>How to handle maintenance requests</li>
        </ul>
      </main>
      <Footer />
    </div>
  )
}
