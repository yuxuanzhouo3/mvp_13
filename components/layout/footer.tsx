"use client"

import Link from "next/link"
import { useTranslations } from 'next-intl'
import { Shield, Facebook, Twitter, Instagram, Linkedin } from "lucide-react"

export function Footer() {
  const t = useTranslations('footer')

  const footerLinks = {
    [t('forRenters')]: [
      { name: t('findHomes'), href: "/search" },
      { name: t('howItWorks'), href: "/how-it-works" },
      { name: t('depositProtection'), href: "/deposit-protection" },
      { name: t('renterResources'), href: "/resources/renters" },
    ],
    [t('forLandlords')]: [
      { name: t('listProperty'), href: "/list-property" },
      { name: t('landlordTools'), href: "/tools" },
      { name: t('pricing'), href: "/pricing" },
      { name: t('successStories'), href: "/success-stories" },
    ],
    [t('support')]: [
      { name: t('helpCenter'), href: "/help" },
      { name: t('contactUs'), href: "/contact" },
      { name: t('disputeResolution'), href: "/dispute-resolution" },
      { name: t('writeReview'), href: "/testimonial" },
    ],
    [t('company')]: [
      { name: t('aboutUs'), href: "/about" },
      { name: t('careers'), href: "/careers" },
      { name: t('press'), href: "/press" },
      { name: t('legal'), href: "/legal" },
    ],
  }

  return (
    <footer className="bg-muted/30 border-t">
      <div className="container py-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <Shield className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">RentGuard</span>
            </Link>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {t('description')}
            </p>
            <div className="flex space-x-4">
              <Link href="#" className="text-muted-foreground hover:text-primary">
                <Facebook className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-primary">
                <Twitter className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-primary">
                <Instagram className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-muted-foreground hover:text-primary">
                <Linkedin className="h-5 w-5" />
              </Link>
            </div>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-semibold mb-4">{category}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="text-muted-foreground hover:text-primary transition-colors">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-muted-foreground text-sm">{t('copyright')}</p>
          <div className="flex space-x-6 mt-4 sm:mt-0">
            <Link href="/privacy" className="text-muted-foreground hover:text-primary text-sm">
              {t('privacyPolicy')}
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-primary text-sm">
              {t('termsOfService')}
            </Link>
            <Link href="/cookies" className="text-muted-foreground hover:text-primary text-sm">
              {t('cookiePolicy')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
