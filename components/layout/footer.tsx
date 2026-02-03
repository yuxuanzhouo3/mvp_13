import Link from "next/link"
import { Shield, Facebook, Twitter, Instagram, Linkedin } from "lucide-react"

export function Footer() {
  const footerLinks = {
    "For Renters": [
      { name: "Find Homes", href: "/search" },
      { name: "How it Works", href: "/how-it-works" },
      { name: "Deposit Protection", href: "/deposit-protection" },
      { name: "Renter Resources", href: "/resources/renters" },
    ],
    "For Landlords": [
      { name: "List Property", href: "/list-property" },
      { name: "Landlord Tools", href: "/tools" },
      { name: "Pricing", href: "/pricing" },
      { name: "Success Stories", href: "/success-stories" },
    ],
    Support: [
      { name: "Help Center", href: "/help" },
      { name: "Contact Us", href: "/contact" },
      { name: "Dispute Resolution", href: "/dispute-resolution" },
      { name: "Write a Review", href: "/testimonial" },
    ],
    Company: [
      { name: "About Us", href: "/about" },
      { name: "Careers", href: "/careers" },
      { name: "Press", href: "/press" },
      { name: "Legal", href: "/legal" },
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
              Secure house rentals with deposit protection, dispute resolution, and seamless payment processing.
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
          <p className="text-muted-foreground text-sm">© 2024 RentGuard. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 sm:mt-0">
            <Link href="/privacy" className="text-muted-foreground hover:text-primary text-sm">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-primary text-sm">
              Terms of Service
            </Link>
            <Link href="/cookies" className="text-muted-foreground hover:text-primary text-sm">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
