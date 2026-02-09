import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Search, FileCheck, DollarSign } from "lucide-react"
import { useTranslations } from "next-intl"

export default function HowItWorksPage() {
  const t = useTranslations('howItWorksPage')

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-12">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">{t('title')}</h1>
            <p className="text-xl text-muted-foreground">
              {t('subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <Search className="h-8 w-8 text-primary mb-2" />
                <CardTitle>{t('step1Title')}</CardTitle>
                <CardDescription>
                  {t('step1Desc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('step1Content')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <FileCheck className="h-8 w-8 text-primary mb-2" />
                <CardTitle>{t('step2Title')}</CardTitle>
                <CardDescription>
                  {t('step2Desc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('step2Content')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <DollarSign className="h-8 w-8 text-primary mb-2" />
                <CardTitle>{t('step3Title')}</CardTitle>
                <CardDescription>
                  {t('step3Desc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('step3Content')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 text-primary mb-2" />
                <CardTitle>{t('step4Title')}</CardTitle>
                <CardDescription>
                  {t('step4Desc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t('step4Content')}
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
