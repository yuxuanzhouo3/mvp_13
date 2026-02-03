import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Search, FileCheck, DollarSign } from "lucide-react"

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-12">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">How It Works</h1>
            <p className="text-xl text-muted-foreground">
              Simple, secure, and transparent rental process
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <Search className="h-8 w-8 text-primary mb-2" />
                <CardTitle>1. Search Properties</CardTitle>
                <CardDescription>
                  Use AI-powered search to find your ideal home
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Simply describe what you're looking for in natural language, and our AI will find matching properties from multiple platforms.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <FileCheck className="h-8 w-8 text-primary mb-2" />
                <CardTitle>2. Apply & Get Approved</CardTitle>
                <CardDescription>
                  Submit your application and get approved quickly
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Apply directly through our platform. Landlords can review and approve applications efficiently.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <DollarSign className="h-8 w-8 text-primary mb-2" />
                <CardTitle>3. Secure Deposit</CardTitle>
                <CardDescription>
                  Your deposit is protected with our escrow service
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Premium members can use our deposit protection service. Your deposit is held securely until the end of your lease.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 text-primary mb-2" />
                <CardTitle>4. Move In & Enjoy</CardTitle>
                <CardDescription>
                  Start your rental journey with peace of mind
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Move into your new home knowing your deposit is protected and any disputes will be handled fairly.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
