import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export default function LandlordToolsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container py-12 flex-1">
        <h1 className="text-4xl font-bold mb-6">Landlord Tools</h1>
        <p className="text-lg text-muted-foreground mb-4">
          Manage your properties efficiently with our suite of landlord tools.
        </p>
        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <div className="p-6 border rounded-lg">
            <h2 className="text-2xl font-semibold mb-2">Property Management</h2>
            <p>Track maintenance requests, lease agreements, and property details in one place.</p>
          </div>
          <div className="p-6 border rounded-lg">
            <h2 className="text-2xl font-semibold mb-2">Tenant Screening</h2>
            <p>Make informed decisions with our comprehensive tenant screening services.</p>
          </div>
          <div className="p-6 border rounded-lg">
            <h2 className="text-2xl font-semibold mb-2">Financial Reports</h2>
            <p>Generate detailed financial reports to keep track of your rental income and expenses.</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
