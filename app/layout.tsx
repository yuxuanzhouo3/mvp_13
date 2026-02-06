import type React from "react"
import type { Metadata } from "next"
//import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'

//const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "RentGuard - Secure House Rentals & Deposit Protection",
  description: "Find your perfect home or list your property with secure deposit protection and dispute resolution.",
  keywords: "house rental, deposit protection, property listing, tenant landlord matching",
    generator: 'v0.app'
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 根据环境变量获取语言
  const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
  const locale = region === 'china' ? 'zh' : 'en'
  
  let messages
  try {
    messages = await getMessages({ locale })
  } catch (error) {
    console.error('Failed to load messages:', error)
    // 降级到英文
    messages = await getMessages({ locale: 'en' })
  }

  return (
    <html lang={locale} suppressHydrationWarning>
       <body >
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            {children}
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
