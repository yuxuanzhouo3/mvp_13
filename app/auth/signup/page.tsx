"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useTranslations } from 'next-intl'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Shield, Chrome, Apple } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ref = searchParams.get("ref")
  const sig = searchParams.get("sig")
  const { toast } = useToast()
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')
  const [userType, setUserType] = useState<"tenant" | "landlord" | "agent">("tenant")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    const typeParam = searchParams.get("userType")
    const emailParam = searchParams.get("email")
    if (typeParam) {
      const normalized = typeParam.toLowerCase()
      if (normalized === "tenant" || normalized === "landlord" || normalized === "agent") {
        setUserType(normalized as "tenant" | "landlord" | "agent")
      }
    }
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [searchParams])

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      toast({
        title: t('passwordsNotMatch'),
        description: t('passwordsNotMatch'),
        variant: "destructive",
      })
      return
    }

    if (password.length < 6) {
      toast({
        title: t('passwordTooShort'),
        description: t('passwordTooShort'),
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      // 添加超时控制
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60秒超时
      
      let response: Response
      let data: any
      
      try {
        response = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            name: email.split("@")[0], // 使用邮箱前缀作为默认名称
            phone: phone || undefined,
            userType: userType.toUpperCase(),
            ref: ref || undefined, // 传递邀请码
            sig: sig || undefined,
          }),
          signal: controller.signal
        })
        clearTimeout(timeoutId)
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') {
          throw new Error(process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '请求超时，请稍后重试' : 'Request timeout, please try again')
        }
        throw new Error(process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '网络错误，请检查网络连接' : 'Network error, please check your connection')
      }

      // 尝试解析响应
      try {
        const text = await response.text()
        if (!text) {
          throw new Error(process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '服务器返回空响应' : 'Server returned empty response')
        }
        data = JSON.parse(text)
      } catch (parseError) {
        console.error('[Signup Frontend] 解析响应失败:', parseError)
        throw new Error(process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '服务器响应格式错误' : 'Invalid server response format')
      }

      if (!response.ok) {
        const errorMsg = data?.error || data?.message || t('signupFailed') || (process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '注册失败' : 'Signup failed')
        throw new Error(errorMsg)
      }

      // 保存 token
      if (data.token) {
        localStorage.setItem("auth-token", data.token)
        localStorage.setItem("user", JSON.stringify(data.user))
      }

      toast({
        title: tCommon('success'),
        description: t('signupSuccessful') || "Welcome to RentGuard!",
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
      // 处理超时错误
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        toast({
          title: process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '请求超时' : 'Request timeout',
          description: process.env.NEXT_PUBLIC_APP_REGION === 'china' ? '请求超时，请稍后重试' : 'Request timeout, please try again',
          variant: "destructive",
        })
      } else {
        // 如果错误信息已经包含了 "Registration failed" 或 "注册失败"，直接使用
        // 否则添加前缀
        let errorMessage = error.message || t('signupFailed')
        const lower = errorMessage.toLowerCase()
        if (!lower.includes('registration failed') && !lower.includes('注册失败') && !lower.includes('signup failed')) {
          errorMessage = `${t('signupFailed')}: ${errorMessage}`
        }
        
        toast({
          title: t('signupFailed'),
          description: errorMessage,
          variant: "destructive",
        })
      }
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
          <CardTitle className="text-2xl">{t('signupTitle')}</CardTitle>
          <CardDescription>{t('signupDescription')}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* User Type Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">{t('iAmA')}</Label>
            <Tabs value={userType} onValueChange={(value) => setUserType(value as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="tenant">{t('tenant')}</TabsTrigger>
                <TabsTrigger value="landlord">{t('landlord')}</TabsTrigger>
                <TabsTrigger value="agent">{t('agent')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3">
            <Button variant="outline" className="w-full bg-transparent" size="lg">
              <Chrome className="mr-2 h-4 w-4" />
              {t('continueWithGoogle')}
            </Button>
            <Button variant="outline" className="w-full bg-transparent" size="lg">
              <Apple className="mr-2 h-4 w-4" />
              {t('continueWithApple')}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">{t('orContinueWith')}</span>
            </div>
          </div>

          {/* Email/Phone Tabs */}
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">{t('email')}</TabsTrigger>
              <TabsTrigger value="phone">{t('phone')}</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-4 mt-4">
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
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t('confirmPassword')}</Label>
                <Input 
                  id="confirm-password" 
                  type="password" 
                  placeholder={t('confirmPassword')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </TabsContent>

            <TabsContent value="phone" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="phone">{t('phoneNumber')}</Label>
                <Input id="phone" type="tel" placeholder={t('phoneNumber')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="verification">{t('verificationCode')}</Label>
                <Input id="verification" placeholder={t('verificationCode')} />
              </div>
            </TabsContent>
          </Tabs>

          <Button 
            className="w-full" 
            size="lg"
            onClick={handleSignup}
            disabled={loading}
          >
            {loading ? tCommon('loading') : t('signupTitle')}
          </Button>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">{t('alreadyHaveAccount')} </span>
            <Link href="/auth/login" className="text-primary hover:underline">
              {t('signIn')}
            </Link>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            {t('agreeToTerms')}{" "}
            <Link href="/terms" className="text-primary hover:underline">
              {t('termsOfService')}
            </Link>{" "}
            {t('and')}{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              {t('privacyPolicy')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-muted/30"><div className="text-center">Loading...</div></div>}>
      <SignUpForm />
    </Suspense>
  )
}
