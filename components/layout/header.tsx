"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { Menu, Shield } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"

export function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('common')
  const tNav = useTranslations('navigation')

  const navigation = [
    { name: tNav('findHomes'), href: "/search" },
    { name: tNav('listProperty'), href: "/list-property" },
    { name: tNav('howItWorks'), href: "/how-it-works" },
    { name: tNav('depositProtection'), href: "/deposit-protection" },
  ]

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    if (href === '/search' || href === '/list-property') {
      const token = localStorage.getItem("auth-token")
      if (!token) {
        e.preventDefault()
        setIsOpen(false)
        toast({
          title: "Login Required",
          description: "Please login to continue.",
          variant: "destructive",
        })
        router.push("/auth/login")
      }
    }
    if (isOpen) setIsOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <Shield className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">RentGuard</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          {navigation.map((item) => (
            <Link 
              key={item.name} 
              href={item.href} 
              className="text-sm font-medium transition-colors hover:text-primary"
              onClick={(e) => handleNavClick(e, item.href)}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center space-x-4">
          <ModeToggle />
          <div className="hidden md:flex items-center space-x-2">
            <Button variant="ghost" asChild>
              <Link href="/auth/login">{t('login')}</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/signup">{t('signup')}</Link>
            </Button>
          </div>

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <nav className="flex flex-col space-y-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="text-lg font-medium transition-colors hover:text-primary"
                    onClick={(e) => handleNavClick(e, item.href)}
                  >
                    {item.name}
                  </Link>
                ))}
                <div className="flex flex-col space-y-2 pt-4">
                  <Button variant="ghost" asChild>
                    <Link href="/auth/login">{t('login')}</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/auth/signup">{t('signup')}</Link>
                  </Button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
