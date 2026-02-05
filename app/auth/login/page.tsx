"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useTranslations } from 'next-intl'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 不传递 region，让后端根据环境变量自动判断
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('loginFailed'))
      }

      // 保存 token 和用户信息
      if (data.token) {
        localStorage.setItem("auth-token", data.token)
        localStorage.setItem("user", JSON.stringify(data.user))
      }

      toast({
        title: tCommon('success'),
        description: t('loginSuccessful'),
      })

      // 根据用户类型跳转
      if (data.user.userType === "TENANT") {
        router.push("/dashboard/tenant")
      } else if (data.user.userType === "LANDLORD") {
        router.push("/dashboard/landlord")
      } else if (data.user.userType === "AGENT") {
        router.push("/dashboard/agent")
      } else {
        router.push("/dashboard/tenant")
      }
    } catch (error: any) {
      toast({
        title: t('loginFailed'),
        description: error.message || t('invalidCredentials'),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t('loginTitle')}</CardTitle>
          <CardDescription>{t('loginDescription')}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? t('signingIn') : t('signIn')}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">{t('dontHaveAccount')} </span>
            <Link href="/auth/signup" className="text-primary hover:underline">
              {tCommon('signup')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
