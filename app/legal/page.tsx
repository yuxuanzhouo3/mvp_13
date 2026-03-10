import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container py-12 flex-1">
        <h1 className="text-4xl font-bold mb-6">Legal Information</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Important legal documents and disclosures.
        </p>
        <ul className="list-disc list-inside space-y-4 text-lg">
          <li><a href="/terms" className="text-primary hover:underline">Terms of Service</a></li>
          <li><a href="/privacy" className="text-primary hover:underline">Privacy Policy</a></li>
          <li><a href="/cookies" className="text-primary hover:underline">Cookie Policy</a></li>
          <li><a href="#" className="text-primary hover:underline">Acceptable Use Policy</a></li>
          <li><a href="#" className="text-primary hover:underline">Intellectual Property Policy</a></li>
        </ul>
      </main>
      <Footer />
    </div>
  )
}
