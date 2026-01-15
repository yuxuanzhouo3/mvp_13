import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Check, X, Eye, MessageSquare } from "lucide-react"

const applications = [
  {
    id: 1,
    applicant: {
      name: "Emily Rodriguez",
      email: "emily.rodriguez@email.com",
      phone: "+1 (555) 123-4567",
      avatar: "/placeholder.svg?height=40&width=40",
    },
    property: "Modern Downtown Apartment",
    appliedDate: "2024-01-15",
    status: "pending",
    monthlyIncome: 8500,
    creditScore: 750,
    depositAmount: 2800,
  },
  {
    id: 2,
    applicant: {
      name: "David Chen",
      email: "david.chen@email.com",
      phone: "+1 (555) 987-6543",
      avatar: "/placeholder.svg?height=40&width=40",
    },
    property: "Cozy Studio in Capitol Hill",
    appliedDate: "2024-01-12",
    status: "under_review",
    monthlyIncome: 5200,
    creditScore: 680,
    depositAmount: 1600,
  },
  {
    id: 3,
    applicant: {
      name: "Lisa Thompson",
      email: "lisa.thompson@email.com",
      phone: "+1 (555) 456-7890",
      avatar: "/placeholder.svg?height=40&width=40",
    },
    property: "Family House with Garden",
    appliedDate: "2024-01-10",
    status: "approved",
    monthlyIncome: 12000,
    creditScore: 820,
    depositAmount: 4200,
  },
]

export function TenantApplications() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tenant Applications</CardTitle>
        <CardDescription>Review and manage rental applications</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {applications.map((application) => (
            <div key={application.id} className="border rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={application.applicant.avatar || "/placeholder.svg"}
                      alt={application.applicant.name}
                    />
                    <AvatarFallback>
                      {application.applicant.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg">{application.applicant.name}</h3>
                    <p className="text-sm text-muted-foreground">{application.applicant.email}</p>
                    <p className="text-sm text-muted-foreground">{application.applicant.phone}</p>
                  </div>
                </div>
                <Badge
                  variant={
                    application.status === "approved"
                      ? "default"
                      : application.status === "pending"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {application.status.replace("_", " ")}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Property</p>
                  <p className="text-sm text-muted-foreground">{application.property}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Applied Date</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(application.appliedDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Deposit Amount</p>
                  <p className="text-sm text-muted-foreground">${application.depositAmount.toLocaleString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Monthly Income</p>
                  <p className="text-sm text-muted-foreground">${application.monthlyIncome.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Credit Score</p>
                  <p className="text-sm text-muted-foreground">{application.creditScore}</p>
                </div>
              </div>

              <div className="flex space-x-3">
                <Button size="sm" variant="outline">
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </Button>
                <Button size="sm" variant="outline">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Message
                </Button>
                {application.status === "pending" && (
                  <>
                    <Button size="sm" variant="default">
                      <Check className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive">
                      <X className="mr-2 h-4 w-4" />
                      Decline
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
