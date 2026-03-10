import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export default function DisputeResolutionPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container py-12 flex-1">
        <h1 className="text-4xl font-bold mb-6">Dispute Resolution</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Fair and transparent resolution for landlord-tenant disputes.
        </p>
        <div className="prose max-w-none dark:prose-invert">
          <h2>Our Process</h2>
          <p>
            RentGuard provides a neutral platform for resolving disputes regarding deposits, damages, and lease violations.
            Our team of experts reviews evidence from both parties to ensure a fair outcome.
          </p>
          <h2>How it Works</h2>
          <ol>
            <li>Submit a dispute claim with supporting evidence.</li>
            <li>The other party is notified and given a chance to respond.</li>
            <li>Our resolution team reviews the case.</li>
            <li>A decision is made based on the provided evidence and lease terms.</li>
          </ol>
        </div>
      </main>
      <Footer />
    </div>
  )
}
