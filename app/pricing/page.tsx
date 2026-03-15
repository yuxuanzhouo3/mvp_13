import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Check } from "lucide-react"

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container py-12 flex-1">
        <h1 className="text-4xl font-bold mb-6 text-center">Simple, Transparent Pricing</h1>
        <p className="text-lg text-muted-foreground text-center mb-12">
          Choose the plan that fits your needs. No hidden fees.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="border rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4">Basic</h2>
            <p className="text-4xl font-bold mb-6">$0<span className="text-lg font-normal text-muted-foreground">/mo</span></p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> List 1 property</li>
              <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> Basic support</li>
            </ul>
          </div>
          <div className="border rounded-lg p-8 bg-primary/5 border-primary">
            <h2 className="text-2xl font-bold mb-4">Pro</h2>
            <p className="text-4xl font-bold mb-6">$29<span className="text-lg font-normal text-muted-foreground">/mo</span></p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> List up to 10 properties</li>
              <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> Priority support</li>
              <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> Tenant screening</li>
            </ul>
          </div>
          <div className="border rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-4">Enterprise</h2>
            <p className="text-4xl font-bold mb-6">Custom</p>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> Unlimited properties</li>
              <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> Dedicated account manager</li>
              <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> Custom integration</li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
