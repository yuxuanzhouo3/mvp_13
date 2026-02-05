"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, MapPin, Home, Shield } from "lucide-react"
import Link from "next/link"

function SearchBar() {
  const router = useRouter()
  const t = useTranslations('hero')
  const [searchQuery, setSearchQuery] = useState("")

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`)
    } else {
      router.push("/search")
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 p-2 bg-background border rounded-lg shadow-lg">
      <div className="flex-1 flex items-center space-x-2 px-3">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('searchPlaceholder')}
          className="border-0 focus-visible:ring-0 text-base"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSearch()}
        />
      </div>
      <Button size="lg" className="px-8" onClick={handleSearch}>
        <Search className="mr-2 h-4 w-4" />
        {t('search')}
      </Button>
    </div>
  )
}

export function HeroSection() {
  const t = useTranslations('hero')

  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />

      <div className="container relative">
        <div className="mx-auto max-w-4xl text-center">
          <div className="flex justify-center mb-6">
            <div className="flex items-center space-x-2 rounded-full bg-primary/10 px-4 py-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">{t('secureDepositProtection')}</span>
            </div>
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            {t('findYourPerfect')}
            <span className="text-primary"> {t('home')}</span>
            <br />
            {t('withComplete')}
            <span className="text-primary"> {t('protection')}</span>
          </h1>

          <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
            {t('description')}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8 py-6" asChild>
              <Link href="/search">
                <Home className="mr-2 h-5 w-5" />
                {t('findAHome')}
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 bg-transparent" asChild>
              <Link href="/list-property">
                <Shield className="mr-2 h-5 w-5" />
                {t('listYourProperty')}
              </Link>
            </Button>
          </div>

          {/* Search Bar */}
          <div className="mt-12 max-w-2xl mx-auto">
            <SearchBar />
          </div>
        </div>
      </div>
    </section>
  )
}
