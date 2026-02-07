"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CreditCard, Smartphone } from "lucide-react"

interface PaymentMethodDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectMethod: (method: 'alipay' | 'wechat' | 'stripe' | 'paypal') => void
  amount: number
  currency: string
}

export function PaymentMethodDialog({
  open,
  onOpenChange,
  onSelectMethod,
  amount,
  currency
}: PaymentMethodDialogProps) {
  const region = process.env.NEXT_PUBLIC_APP_REGION || 'global'
  const isChina = region === 'china'
  const currencySymbol = currency === 'CNY' ? '¥' : '$'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isChina ? '选择支付方式' : 'Select Payment Method'}
          </DialogTitle>
          <DialogDescription>
            {isChina 
              ? `请选择支付方式，支付金额：${currencySymbol}${amount.toLocaleString()}`
              : `Please select a payment method. Amount: ${currencySymbol}${amount.toLocaleString()}`
            }
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          {isChina ? (
            <>
              {/* 支付宝 */}
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-blue-50 hover:border-blue-500"
                onClick={() => {
                  onSelectMethod('alipay')
                  onOpenChange(false)
                }}
              >
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <span className="font-semibold">支付宝</span>
              </Button>
              
              {/* 微信支付 */}
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-green-50 hover:border-green-500"
                onClick={() => {
                  onSelectMethod('wechat')
                  onOpenChange(false)
                }}
              >
                <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                  <Smartphone className="h-6 w-6 text-white" />
                </div>
                <span className="font-semibold">微信支付</span>
              </Button>
            </>
          ) : (
            <>
              {/* Stripe */}
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-purple-50 hover:border-purple-500"
                onClick={() => {
                  onSelectMethod('stripe')
                  onOpenChange(false)
                }}
              >
                <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <span className="font-semibold">Stripe</span>
              </Button>
              
              {/* PayPal */}
              <Button
                variant="outline"
                className="h-24 flex flex-col items-center justify-center space-y-2 hover:bg-blue-50 hover:border-blue-500"
                onClick={() => {
                  onSelectMethod('paypal')
                  onOpenChange(false)
                }}
              >
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <span className="font-semibold">PayPal</span>
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
