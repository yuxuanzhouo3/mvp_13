import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, CreditCard, Shield } from "lucide-react"

interface PaymentHistoryProps {
  userType: "tenant" | "landlord"
}

const payments = [
  {
    id: 1,
    date: "2024-01-01",
    description: "Monthly Rent - Downtown Apartment",
    amount: 2800,
    status: "completed",
    type: "rent",
  },
  {
    id: 2,
    date: "2023-12-15",
    description: "Security Deposit - Downtown Apartment",
    amount: 2800,
    status: "held_in_escrow",
    type: "deposit",
  },
  {
    id: 3,
    date: "2023-12-01",
    description: "Monthly Rent - Downtown Apartment",
    amount: 2800,
    status: "completed",
    type: "rent",
  },
]

export function PaymentHistory({ userType }: PaymentHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CreditCard className="h-5 w-5" />
          <span>Payment History</span>
        </CardTitle>
        <CardDescription>
          {userType === "tenant"
            ? "Track your rent payments and deposit status"
            : "Monitor incoming payments and deposits"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {payments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  {payment.type === "deposit" ? (
                    <Shield className="h-5 w-5 text-primary" />
                  ) : (
                    <CreditCard className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div>
                  <div className="font-medium">{payment.description}</div>
                  <div className="text-sm text-muted-foreground">{new Date(payment.date).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-semibold text-lg">${payment.amount.toLocaleString()}</div>
                <div className="flex items-center space-x-2">
                  <Badge variant={payment.status === "completed" ? "default" : "secondary"}>
                    {payment.status.replace("_", " ")}
                  </Badge>
                  <Button size="sm" variant="ghost">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
