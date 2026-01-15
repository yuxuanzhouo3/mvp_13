import { Card, CardContent } from "@/components/ui/card"
import { Shield, CreditCard, MessageSquare, FileCheck, Users, Gavel } from "lucide-react"

const features = [
  {
    icon: Shield,
    title: "Secure Deposit Protection",
    description: "Your deposits are held in secure escrow accounts with full transparency and protection.",
  },
  {
    icon: CreditCard,
    title: "Seamless Payments",
    description: "Automated rent collection and secure payment processing with detailed tracking.",
  },
  {
    icon: MessageSquare,
    title: "Real-time Communication",
    description: "Built-in messaging system for landlords and tenants with instant notifications.",
  },
  {
    icon: FileCheck,
    title: "Digital Contracts",
    description: "Legally binding digital lease agreements with e-signature capabilities.",
  },
  {
    icon: Users,
    title: "Verified Users",
    description: "Background checks and verification for both tenants and landlords.",
  },
  {
    icon: Gavel,
    title: "Dispute Resolution",
    description: "Professional mediation and arbitration services for conflict resolution.",
  },
]

export function FeaturesSection() {
  return (
    <section className="py-20 lg:py-32">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything You Need for Safe Rentals</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Our platform provides comprehensive protection and tools for both tenants and landlords.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Card key={index} className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
