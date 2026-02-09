"use client"

import { useState, useEffect } from "react"
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, CreditCard, Shield } from "lucide-react"
import { getCurrencySymbol } from "@/lib/utils"
import { PaymentMethodDialog } from "./payment-method-dialog"

interface PaymentHistoryProps {
  userType: "tenant" | "landlord"
}

export function PaymentHistory({ userType }: PaymentHistoryProps) {
  const t = useTranslations('dashboard')
  const tPayment = useTranslations('payment')
  const tCommon = useTranslations('common')
  const currencySymbol = getCurrencySymbol()
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<any>(null)
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)
  // 获取region，客户端组件可以直接访问NEXT_PUBLIC_开头的环境变量
  const isChina = (process.env.NEXT_PUBLIC_APP_REGION || 'global') === 'china'
  
  // 检查URL参数，显示支付成功提示
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('success') === 'true') {
        setShowPaymentSuccess(true)
        // 立即刷新支付列表
        fetchPayments()
        // 多次刷新，确保状态更新（notify回调可能需要几秒钟）
        setTimeout(() => fetchPayments(), 1000)
        setTimeout(() => fetchPayments(), 2000)
        setTimeout(() => fetchPayments(), 3000)
        setTimeout(() => fetchPayments(), 5000)
        setTimeout(() => fetchPayments(), 8000)
        setTimeout(() => fetchPayments(), 10000)
        // 清除URL参数
        window.history.replaceState({}, '', window.location.pathname)
      }
      // 检查是否有outTradeNo参数（从支付宝返回）
      const outTradeNo = params.get('outTradeNo')
      if (outTradeNo) {
        console.log('Received outTradeNo from Alipay return:', outTradeNo)
        // 立即刷新支付列表
        fetchPayments()
        setTimeout(() => fetchPayments(), 2000)
        setTimeout(() => fetchPayments(), 5000)
      }
    }
  }, [])
  
  // 定期刷新支付列表，确保状态同步（支付完成后更频繁刷新）
  useEffect(() => {
    // 如果显示支付成功提示，更频繁地刷新
    if (showPaymentSuccess) {
      const interval = setInterval(() => {
        fetchPayments()
      }, 2000) // 每2秒刷新一次
      return () => clearInterval(interval)
    } else {
      const interval = setInterval(() => {
        fetchPayments()
      }, 10000) // 每10秒刷新一次
      return () => clearInterval(interval)
    }
  }, [showPaymentSuccess])

  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    try {
      const token = localStorage.getItem("auth-token")
      if (!token) return

      const response = await fetch("/api/payments", {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store' // 确保获取最新数据
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Fetched payments:', data.payments?.length, data.payments)
        setPayments(data.payments || [])
      } else {
        console.error('Failed to fetch payments:', response.status, await response.text())
      }
    } catch (error) {
      console.error("Failed to fetch payments:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmCheckIn = async (paymentId: string) => {
    if (!confirm(t('confirmCheckInPrompt') || "Are you sure you want to confirm check-in? This will release the funds to the landlord.")) return

    try {
      const token = localStorage.getItem("auth-token")
      const response = await fetch(`/api/payments/${paymentId}/release`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        // Refresh payments
        fetchPayments()
        // Show success message
        // toast({ title: "Success", description: "Check-in confirmed and funds released." }) // Need to import toast if we want to use it, currently not imported in this component or passed as prop. 
        // Just relying on refresh for now or console.
        console.log("Funds released")
      } else {
        const data = await response.json()
        alert(data.error || "Failed to confirm check-in")
      }
    } catch (error) {
      console.error("Release error:", error)
      alert("An error occurred")
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>{tPayment('title')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">{tCommon('loading')}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CreditCard className="h-5 w-5" />
          <span>{tPayment('title')}</span>
        </CardTitle>
        <CardDescription>
          {userType === "tenant"
            ? (t('trackRentPayments') || "Track your rent payments and deposit status")
            : (t('monitorPayments') || "Monitor incoming payments and deposits")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* 支付成功提示 */}
        {showPaymentSuccess && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">✓</span>
              </div>
              <div>
                <p className="font-semibold text-green-800">
                  {isChina ? '支付成功！' : 'Payment Successful!'}
                </p>
                <p className="text-sm text-green-600">
                  {isChina 
                    ? '您的支付已完成，资金已进入托管账户。' 
                    : 'Your payment has been completed and funds are in escrow.'}
                </p>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                setShowPaymentSuccess(false)
                fetchPayments()
              }}
            >
              {isChina ? '确定' : 'OK'}
            </Button>
          </div>
        )}
        {payments.length > 0 ? (
          <div className="space-y-4">
            {payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                    {payment.type === "DEPOSIT" ? (
                      <Shield className="h-5 w-5 text-primary" />
                    ) : (
                      <CreditCard className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{payment.description || `${payment.type} - ${payment.property?.title || (isChina ? '房源' : 'Property')}`}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(payment.createdAt).toLocaleDateString()}
                      {payment.status === 'PENDING' && (
                        <Badge variant="outline" className="ml-2 text-amber-600 border-amber-600">
                          {isChina ? '待支付' : 'Pending'}
                        </Badge>
                      )}
                      {payment.status === 'COMPLETED' && (
                        <Badge variant="default" className="ml-2 text-green-600 border-green-600 bg-green-50">
                          {isChina ? '已支付' : 'Paid'}
                        </Badge>
                      )}
                    </div>
                    {/* Breakdown for Landlords */}
                    {userType === 'landlord' && payment.distribution && (
                      <div className="mt-2 text-xs space-y-1 bg-muted/50 p-2 rounded w-64">
                        <div className="flex justify-between">
                          <span>{isChina ? '总额' : 'Total'}:</span>
                          <span>{currencySymbol}{payment.amount}</span>
                        </div>
                        <div className="flex justify-between text-destructive">
                          <span>{isChina ? '平台费' : 'Platform Fee'}:</span>
                          <span>-{currencySymbol}{payment.distribution.platformFee}</span>
                        </div>
                        {(payment.distribution.listingAgentFee > 0 || payment.distribution.tenantAgentFee > 0) && (
                          <div className="flex justify-between text-destructive">
                            <span>{isChina ? '中介佣金' : 'Agent Commission'}:</span>
                            <span>-{currencySymbol}{((payment.distribution.listingAgentFee || 0) + (payment.distribution.tenantAgentFee || 0)).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-green-600 pt-1 border-t border-border">
                          <span>{isChina ? '净收入' : 'Net Income'}:</span>
                          <span>{currencySymbol}{payment.distribution.landlordNet}</span>
                        </div>
                      </div>
                    )}
                    {/* Check-in Button for Tenants */}
                    {userType === 'tenant' && payment.type === 'RENT' && payment.escrowStatus === 'HELD_IN_ESCROW' && (
                      <div className="mt-2">
                         <Button size="sm" onClick={() => handleConfirmCheckIn(payment.id)} className="bg-green-600 hover:bg-green-700 text-white h-8">
                           <Shield className="h-3 w-3 mr-2" />
                           {t('confirmCheckIn') || "Confirm Check-in"}
                         </Button>
                         <p className="text-xs text-muted-foreground mt-1">
                           {t('confirmCheckInDesc') || "Click to release funds to landlord"}
                         </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-semibold text-lg">{currencySymbol}{payment.amount.toLocaleString()}</div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={payment.status === "COMPLETED" ? "default" : payment.status === "PENDING" ? "outline" : "secondary"}>
                      {(() => {
                        if (payment.status === "COMPLETED") {
                          return isChina ? "已支付" : "Paid"
                        } else if (payment.status === "PENDING") {
                          return isChina ? "待支付" : "Pending"
                        } else if (payment.status === "FAILED") {
                          return isChina ? "失败" : "Failed"
                        } else if (payment.status === "REFUNDED") {
                          return isChina ? "已退款" : "Refunded"
                        } else {
                          return isChina ? payment.status : payment.status.replace("_", " ").toLowerCase()
                        }
                      })()}
                    </Badge>
                    {payment.status === "PENDING" && userType === "tenant" && (
                      <div className="flex items-center space-x-2">
                        <Button size="sm" variant="default" onClick={() => {
                          setSelectedPayment(payment)
                          setPaymentDialogOpen(true)
                        }}>
                          {isChina ? "立即支付" : "Pay Now"}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={async () => {
                            try {
                              const token = localStorage.getItem("auth-token")
                              if (!token) {
                                alert(isChina ? '请先登录' : 'Please login first')
                                return
                              }
                              
                              const response = await fetch(`/api/payments/${payment.id}/check-status`, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${token}`,
                                },
                              })
                              
                              const data = await response.json()
                              
                              if (response.ok) {
                                if (data.payment?.status === 'COMPLETED') {
                                  alert(isChina ? '支付状态已更新为已支付！' : 'Payment status updated to Paid!')
                                  fetchPayments()
                                } else {
                                  alert(isChina ? '支付状态检查完成，当前状态：' + data.payment?.status : 'Payment status checked: ' + data.payment?.status)
                                  fetchPayments()
                                }
                              } else {
                                alert(data.error || (isChina ? '检查支付状态失败' : 'Failed to check payment status'))
                              }
                            } catch (error) {
                              console.error('Check payment status error:', error)
                              alert(isChina ? '检查支付状态失败' : 'Failed to check payment status')
                            }
                          }}
                        >
                          {isChina ? "检查状态" : "Check Status"}
                        </Button>
                      </div>
                    )}
                    {payment.status === "COMPLETED" && userType === "tenant" && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          // 跳转到支付详情或刷新页面
                          window.location.href = `/dashboard/tenant/payments?paymentId=${payment.id}`
                        }}
                      >
                        {isChina ? "支付详情" : "Payment Details"}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">{t('noPaymentsFound')}</div>
        )}
      </CardContent>
      
      {/* Payment Method Dialog */}
      {selectedPayment && (
        <PaymentMethodDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          onSelectMethod={async (method) => {
            try {
              console.log('Initiating payment with method:', method)
              const token = localStorage.getItem("auth-token")
              if (!token) {
                alert(isChina ? '请先登录' : 'Please login first')
                return
              }

              // 调用支付API
              const response = await fetch(`/api/payments/${selectedPayment.id}/initiate`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ paymentMethod: method }),
              })

              const data = await response.json()
              console.log('Payment initiation response:', data)
              
              if (response.ok && data.paymentUrl) {
                console.log('Redirecting to payment URL:', data.paymentUrl)
                // 跳转到支付页面
                window.location.href = data.paymentUrl
              } else {
                console.error('Payment initiation failed:', data)
                alert(data.error || (isChina ? '支付初始化失败' : 'Failed to initialize payment'))
              }
            } catch (error) {
              console.error('Payment initiation error:', error)
              alert(isChina ? '支付初始化失败' : 'Failed to initialize payment')
            }
          }}
          amount={selectedPayment.amount}
          currency={process.env.NEXT_PUBLIC_APP_REGION === 'china' ? 'CNY' : 'USD'}
        />
      )}
    </Card>
  )
}
