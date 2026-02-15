"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useTranslations } from 'next-intl'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

function LoginContent() {
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const navigateByRole = (rawType?: string) => {
    const userType = (rawType || "").toUpperCase()
    let target = "/dashboard/tenant"
    if (userType === "LANDLORD") target = "/dashboard/landlord"
    if (userType === "AGENT") target = "/dashboard/agent"
    router.replace(target)
    if (typeof window !== "undefined") {
      setTimeout(() => {
        if (window.location.pathname === "/auth/login") {
          window.location.href = target
        }
      }, 120)
    }
  }

  useEffect(() => {
    const token = searchParams.get("token")
    const error = searchParams.get("error")

    if (error) {
      toast({
        description: error,
        variant: "destructive",
      })
      return
    }

    if (!token) return

    const completeOAuthLogin = async () => {
      setLoading(true)
      try {
        localStorage.setItem("auth-token", token)
        const response = await fetch("/api/auth/profile", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          const errorMsg = data.error || t('invalidCredentials')
          throw new Error(errorMsg)
        }

        if (data.user) {
          localStorage.setItem("user", JSON.stringify(data.user))
        }

        navigateByRole(data.user?.userType)
      } catch (error: any) {
        const errorMessage = error.message || t('invalidCredentials')
        toast({
          description: errorMessage,
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    completeOAuthLogin()
  }, [searchParams, router, toast, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const isChina = process.env.NEXT_PUBLIC_APP_REGION === 'china'
    const isGlobal = !isChina

    try {
      const normalizedEmail = email.trim()
      const normalizedPassword = password
      const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
        return await Promise.race([
          promise,
          new Promise<T>((_, reject) => {
            setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
          })
        ])
      }
      const fetchProfile = async (token: string) => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)
        try {
          const response = await fetch("/api/auth/profile", {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          })
          const data = await response.json().catch(() => ({}))
          if (!response.ok) {
            throw new Error(data.error || t('invalidCredentials'))
          }
          return data.user || null
        } finally {
          clearTimeout(timeoutId)
        }
      }
      const backendLogin = async (options?: { useJwtOnly?: boolean }) => {
        const controller = new AbortController()
        // 后端整次登录最长约 80s；前端设置 90s 超时以覆盖极端情况
        const timeoutMs = process.env.NEXT_PUBLIC_APP_REGION === 'china' ? 30000 : 20000
        console.log('[Login Frontend] Timeout setting:', { region: process.env.NEXT_PUBLIC_APP_REGION, timeoutMs })
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
        // 8s 后提示“正在验证”，避免用户以为卡死
        const hintId = setTimeout(() => {
          toast({
            description: isChina ? '正在验证，请稍候…' : 'Verifying, please wait…',
            variant: 'default',
          })
        }, 8000)
        try {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
              email: normalizedEmail, 
              password: normalizedPassword, 
              useJwtOnly: options?.useJwtOnly || false 
            }),
            signal: controller.signal
          })
          if (timeoutId) clearTimeout(timeoutId)
          if (hintId) clearTimeout(hintId)
          const text = await response.text()
          const data = text ? JSON.parse(text) : {}
          if (!response.ok) {
            const errorMsg = data?.error || data?.message || t('invalidCredentials') || (process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '登录失败' : 'Login failed')
            const error = new Error(errorMsg)
            ;(error as any).status = response.status
            throw error
          }
          if (!data?.token) {
            throw new Error(process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '登录响应数据无效' : 'Invalid login response data')
          }
          localStorage.setItem("auth-token", data.token)
          if (data.user) {
            localStorage.setItem("user", JSON.stringify(data.user))
          }
          toast({
            title: tCommon('success'),
            description: t('loginSuccessful'),
          })
          navigateByRole(data.user?.userType)
          setLoading(false)
          return true
        } catch (fetchError: any) {
          if (hintId) clearTimeout(hintId)
          if (fetchError.name === 'AbortError') {
            throw new Error(isChina ? '请求超时，请稍后重试' : 'Request timeout, please try again')
          }
          throw fetchError
        }
      }

      if (isGlobal) {
        try {
          await backendLogin()
          return
        } catch (backendError: any) {
          const backendStatus = (backendError as any)?.status
          const message = String(backendError?.message || '')
          const lower = message.toLowerCase()
          if (
            lower.includes('supabase') ||
            lower.includes('管理权限') ||
            lower.includes('service role')
          ) {
            toast({
              title: tCommon('error'),
              description: message || t('invalidCredentials'),
              variant: "destructive",
            })
            return
          }
          if (
            lower.includes('invalid login credentials') ||
            lower.includes('邮箱或密码错误') ||
            backendStatus === 401
          ) {
            toast({
              title: tCommon('error'),
              description: t('invalidCredentials'),
              variant: "destructive",
            })
            return
          }
          throw backendError
        }
      }

      await backendLogin()
    } catch (error: any) {
      // 处理超时错误
      const message = String(error?.message || '')
      if (error.name === 'AbortError' || message.includes('超时') || message.toLowerCase().includes('timeout')) {
        toast({
          title: isChina ? '请求超时' : 'Request timeout',
          description: isChina ? '请求超时，请稍后重试' : 'Request timeout, please try again',
          variant: "destructive",
        })
        setLoading(false)
        return
      }
      
      // 优化错误日志打印
      console.error('[Login Frontend] Login Error Object:', error)
      let errorMessage = error.message || String(error) || t('invalidCredentials')
      
      // 暂时移除对中文错误的强制替换，以便排查真实原因
      /*
      if (isGlobal) {
        const hasChinese = /[\u4e00-\u9fa5]/.test(errorMessage)
        if (hasChinese) {
          errorMessage = 'Login failed, please try again'
        }
      }
      */
      
      console.error('[Login Frontend] Error Message:', errorMessage)
      
      // 只显示 description，避免重复显示 "Login failed"
      toast({
        title: tCommon('error'),
        description: errorMessage,
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-muted/30"><div className="text-center">Loading...</div></div>}>
      <LoginContent />
    </Suspense>
  )
}
