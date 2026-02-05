"use client"

import { useTranslations } from 'next-intl'
import { Card, CardContent } from "@/components/ui/card"
import { Shield, CreditCard, MessageSquare, FileCheck, Users, Gavel } from "lucide-react"

export function FeaturesSection() {
  const t = useTranslations('features')

  const features = [
    {
      icon: Shield,
      title: t('secureDeposit.title'),
      description: t('secureDeposit.description'),
    },
    {
      icon: CreditCard,
      title: t('seamlessPayments.title'),
      description: t('seamlessPayments.description'),
    },
    {
      icon: MessageSquare,
      title: t('realTimeCommunication.title'),
      description: t('realTimeCommunication.description'),
    },
    {
      icon: FileCheck,
      title: t('digitalContracts.title'),
      description: t('digitalContracts.description'),
    },
    {
      icon: Users,
      title: t('verifiedUsers.title'),
      description: t('verifiedUsers.description'),
    },
    {
      icon: Gavel,
      title: t('disputeResolution.title'),
      description: t('disputeResolution.description'),
    },
  ]

  return (
    <section className="py-20 lg:py-32">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t('subtitle')}
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
