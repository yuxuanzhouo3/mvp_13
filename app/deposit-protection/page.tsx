import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Shield, Clock, CheckCircle, AlertTriangle, Gavel, FileText } from "lucide-react"
import { getCurrencySymbol } from "@/lib/utils"
import { useTranslations } from "next-intl"

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

export default function DepositProtectionPage() {
  const currencySymbol = getCurrencySymbol()
  const t = useTranslations('depositProtectionPage')
  
  const timeline = [
    {
      date: "2023-12-15",
      title: t('timelineEvent1Title'),
      description: t('timelineEvent1Desc', { amount: `${currencySymbol}2,800` }),
      status: "completed",
      icon: CheckCircle,
    },
    {
      date: "2023-12-16",
      title: t('timelineEvent2Title'),
      description: t('timelineEvent2Desc'),
      status: "completed",
      icon: FileText,
    },
    {
      date: "2024-01-01",
      title: t('timelineEvent3Title'),
      description: t('timelineEvent3Desc'),
      status: "completed",
      icon: CheckCircle,
    },
    {
      date: "2024-12-31",
      title: t('timelineEvent4Title'),
      description: t('timelineEvent4Desc'),
      status: "pending",
      icon: Clock,
    },
  ]
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
            <h1 className="text-4xl font-bold">{t('title')}</h1>
            <p className="text-xl text-muted-foreground">
              {t('subtitle')}
            </p>
          </div>

          {/* Deposit Status Card */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <span>{t('depositStatus')}</span>
                  </CardTitle>
                  <CardDescription>{depositStatus.property}</CardDescription>
                </div>
                <Badge className="bg-green-100 text-green-800 border-green-200">{t('protected')}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{currencySymbol}{depositStatus.totalAmount.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">{t('totalDeposit')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{currencySymbol}{depositStatus.heldAmount.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">{t('heldInEscrow')}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">100%</div>
                  <div className="text-sm text-muted-foreground">{t('protectionLevel')}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>{t('progressTitle')}</span>
                  <span>{t('active')}</span>
                </div>
                <Progress value={75} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t('depositReceived')}</span>
                  <span>{t('expectedReturn')}: {new Date(depositStatus.expectedReturn).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <div className="text-sm font-medium">{t('tenant')}</div>
                  <div className="text-sm text-muted-foreground">{depositStatus.tenant}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">{t('landlord')}</div>
                  <div className="text-sm text-muted-foreground">{depositStatus.landlord}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>{t('timelineTitle')}</CardTitle>
              <CardDescription>{t('timelineDesc')}</CardDescription>
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
                <h3 className="font-semibold mb-2">{t('downloadDocs')}</h3>
                <p className="text-sm text-muted-foreground mb-4">{t('downloadDocsDesc')}</p>
                <Button variant="outline" className="w-full bg-transparent">
                  {t('download')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-orange-500 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">{t('reportIssue')}</h3>
                <p className="text-sm text-muted-foreground mb-4">{t('reportIssueDesc')}</p>
                <Button variant="outline" className="w-full bg-transparent">
                  {t('report')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 text-center">
                <Gavel className="h-8 w-8 text-red-500 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">{t('disputeResolution')}</h3>
                <p className="text-sm text-muted-foreground mb-4">{t('disputeResolutionDesc')}</p>
                <Button variant="outline" className="w-full bg-transparent">
                  {t('startDispute')}
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
