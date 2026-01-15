import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Shield, Clock, CheckCircle, AlertTriangle, Gavel, FileText } from "lucide-react"

const depositStatus = {
  totalAmount: 2800,
  heldAmount: 2800,
  status: "held_in_escrow",
  property: "Modern Downtown Apartment",
  tenant: "Sarah Johnson",
  landlord: "John Smith",
  depositDate: "2023-12-15",
  expectedReturn: "2024-12-31",
}

const timeline = [
  {
    date: "2023-12-15",
    title: "Deposit Received",
    description: "Security deposit of $2,800 received and held in escrow",
    status: "completed",
    icon: CheckCircle,
  },
  {
    date: "2023-12-16",
    title: "Lease Agreement Signed",
    description: "Digital lease agreement executed by both parties",
    status: "completed",
    icon: FileText,
  },
  {
    date: "2024-01-01",
    title: "Tenancy Started",
    description: "Tenant moved in, deposit protection period active",
    status: "completed",
    icon: CheckCircle,
  },
  {
    date: "2024-12-31",
    title: "Lease End Date",
    description: "Expected lease termination and deposit review",
    status: "pending",
    icon: Clock,
  },
]

export default function DepositProtectionPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Shield className="h-16 w-16 text-primary" />
            </div>
            <h1 className="text-4xl font-bold">Deposit Protection Center</h1>
            <p className="text-xl text-muted-foreground">
              Your security deposits are protected with full transparency and dispute resolution
            </p>
          </div>

          {/* Deposit Status Card */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <span>Deposit Status</span>
                  </CardTitle>
                  <CardDescription>{depositStatus.property}</CardDescription>
                </div>
                <Badge className="bg-green-100 text-green-800 border-green-200">Protected</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">${depositStatus.totalAmount.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Total Deposit</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">${depositStatus.heldAmount.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Held in Escrow</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">100%</div>
                  <div className="text-sm text-muted-foreground">Protection Level</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Deposit Protection Progress</span>
                  <span>Active</span>
                </div>
                <Progress value={75} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Deposit Received</span>
                  <span>Expected Return: {new Date(depositStatus.expectedReturn).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <div className="text-sm font-medium">Tenant</div>
                  <div className="text-sm text-muted-foreground">{depositStatus.tenant}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Landlord</div>
                  <div className="text-sm text-muted-foreground">{depositStatus.landlord}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Deposit Timeline</CardTitle>
              <CardDescription>Track the complete history of your deposit</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {timeline.map((event, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full ${
                        event.status === "completed" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <event.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{event.title}</h3>
                        <span className="text-sm text-muted-foreground">
                          {new Date(event.date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6 text-center">
                <FileText className="h-8 w-8 text-primary mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Download Documents</h3>
                <p className="text-sm text-muted-foreground mb-4">Access your lease agreement and deposit receipts</p>
                <Button variant="outline" className="w-full bg-transparent">
                  Download
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-orange-500 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Report Issue</h3>
                <p className="text-sm text-muted-foreground mb-4">Report property damage or maintenance issues</p>
                <Button variant="outline" className="w-full bg-transparent">
                  Report
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Gavel className="h-8 w-8 text-red-500 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Dispute Resolution</h3>
                <p className="text-sm text-muted-foreground mb-4">Start a formal dispute process if needed</p>
                <Button variant="outline" className="w-full bg-transparent">
                  Start Dispute
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
