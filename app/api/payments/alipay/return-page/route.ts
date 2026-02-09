import { NextRequest, NextResponse } from 'next/server'

/**
 * 支付宝返回页面 - 使用HTML页面进行重定向，避免redirect问题
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const params: any = {}
    
    searchParams.forEach((value, key) => {
      params[key] = value
    })

    console.log('Alipay return-page received:', params)
    console.log('Full URL:', request.url)
    console.log('Search params:', Array.from(searchParams.entries()))

    const tradeStatus = params.trade_status || params.tradeStatus
    const outTradeNo = params.out_trade_no || params.outTradeNo
    const tradeNo = params.trade_no || params.tradeNo
    
    // 构建重定向URL
    // 优先使用相对路径，避免域名配置错误导致跳转失败
    const relativeRedirectUrl = '/dashboard/tenant'
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://7b17d9a0.r27.cpolar.top'
    let absoluteRedirectUrl = `${baseUrl}${relativeRedirectUrl}`
    
    // 更新支付状态
    if (outTradeNo) {
      try {
        const { getDatabaseAdapter } = await import('@/lib/db-adapter')
        const db = getDatabaseAdapter()
        const paymentIdMatch = outTradeNo.match(/^RENT_(.+?)_\d+$/)
        if (paymentIdMatch) {
          const paymentId = paymentIdMatch[1]
          console.log('Updating payment status in return-page:', paymentId)
          
          const payment = await db.findById('payments', paymentId)
          if (payment) {
            // 确保metadata是对象格式
            let metadata = payment.metadata
            if (typeof metadata === 'string') {
              try {
                metadata = JSON.parse(metadata)
              } catch {
                metadata = {}
              }
            }
            if (!metadata || typeof metadata !== 'object') {
              metadata = {}
            }
            
            // 强制更新为已完成状态
            const updateData: any = {
              status: 'COMPLETED',
              escrowStatus: payment.escrowStatus || 'HELD_IN_ESCROW',
              transactionId: tradeNo || payment.transactionId,
              metadata: JSON.stringify({
                ...metadata,
                alipayReturnTime: new Date().toISOString(),
                tradeStatus: tradeStatus || 'TRADE_SUCCESS',
                tradeNo: tradeNo,
                updatedVia: 'return-page',
                lastUpdated: new Date().toISOString()
              })
            }
            
            await db.update('payments', paymentId, updateData)
            console.log('Payment status updated to COMPLETED in return-page')

            // 如果支付成功，发送通知给房东
            try {
              if (payment.propertyId) {
                const property = await db.findById('properties', payment.propertyId)
                if (property && property.landlordId) {
                  // 检查是否已经发送过通知
                  const existingNotifs = await db.query('notifications', {
                    userId: property.landlordId,
                    type: 'PAYMENT_RECEIVED'
                  })
                  
                  // 简单的去重逻辑：如果最近1分钟内有相同支付ID的通知
                  const isDuplicate = existingNotifs.some((n: any) => {
                    const meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata
                    return meta?.paymentId === paymentId && 
                           (new Date().getTime() - new Date(n.createdAt).getTime() < 60000)
                  })

                  if (!isDuplicate) {
                    const isChina = process.env.NEXT_PUBLIC_APP_REGION === 'china'
                    await db.create('notifications', {
                      userId: property.landlordId,
                      type: 'PAYMENT_RECEIVED',
                      title: isChina ? '收到房租支付' : 'Rent Payment Received',
                      message: isChina 
                        ? `租客已支付租金，资金已进入托管账户。`
                        : `Tenant has paid rent, funds are now in escrow.`,
                      isRead: false,
                      link: `/dashboard/landlord`,
                      metadata: JSON.stringify({
                        paymentId: paymentId,
                        propertyId: property.id,
                        type: 'PAYMENT_RECEIVED'
                      })
                    })
                    console.log('Notification sent to landlord in return-page')
                  }
                }
              }
            } catch (notifErr) {
              console.error('Failed to send notification in return-page:', notifErr)
            }
          }
        }
      } catch (updateErr) {
        console.error('Failed to update payment in return-page:', updateErr)
      }
    } else {
      console.warn('No outTradeNo found in return-page params, showing return page anyway')
    }
    
    // 添加查询参数
    let queryParams = ''
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED' || !tradeStatus) {
      queryParams += '?success=true&tab=payments'
    } else if (tradeStatus) {
      queryParams += '?error=payment_failed&tab=payments'
    } else {
      queryParams += '?success=true&tab=payments'
    }
    
    if (outTradeNo) {
      queryParams += `&outTradeNo=${encodeURIComponent(outTradeNo)}`
    }
    
    const finalRelativeUrl = `${relativeRedirectUrl}${queryParams}`
    const finalAbsoluteUrl = `${absoluteRedirectUrl}${queryParams}`
    
    console.log('Redirecting to (relative):', finalRelativeUrl)
    console.log('Redirecting to (absolute):', finalAbsoluteUrl)

    // 返回HTML页面，自动跳转
    const isChina = process.env.NEXT_PUBLIC_APP_REGION === 'china'
    
    // 如果有outTradeNo，尝试自动更新状态
    let autoCheckScript = ''
    if (outTradeNo) {
      const paymentIdMatch = outTradeNo.match(/^RENT_(.+?)_\d+$/)
      if (paymentIdMatch) {
        const paymentId = paymentIdMatch[1]
        autoCheckScript = `
          // 自动检查支付状态
          setTimeout(function() {
            const token = localStorage.getItem('auth-token');
            if (token) {
              fetch('/api/payments/${paymentId}/check-status', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + token
                }
              }).then(res => res.json()).then(data => {
                console.log('Auto-check payment status:', data);
                if (data.payment?.status === 'COMPLETED') {
                  console.log('Payment status is COMPLETED, redirecting...');
                  window.location.replace('${finalRelativeUrl}');
                }
              }).catch(err => {
                console.error('Auto-check error:', err);
              });
            }
          }, 1000);
        `
      }
    }
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${isChina ? '支付成功！' : 'Payment Successful!'}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #333;
            }
            .container {
              background: white;
              border-radius: 12px;
              padding: 40px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 500px;
              width: 90%;
            }
            .success-icon {
              color: #10b981;
              font-size: 64px;
              margin-bottom: 20px;
            }
            h2 {
              margin-top: 0;
              color: #1f2937;
            }
            p {
              color: #4b5563;
              line-height: 1.5;
            }
            .button {
              display: inline-block;
              background-color: #4f46e5;
              color: white;
              padding: 12px 24px;
              border-radius: 6px;
              text-decoration: none;
              font-weight: 500;
              transition: background-color 0.2s;
              border: none;
              cursor: pointer;
            }
            .button:hover {
              background-color: #4338ca;
            }
            .button-secondary {
              background-color: #f3f4f6;
              color: #4b5563;
            }
            .button-secondary:hover {
              background-color: #e5e7eb;
            }
            .countdown {
              color: #9ca3af;
              font-size: 14px;
              margin-top: 20px;
            }
          </style>
          <script>
            // 自动跳转
            setTimeout(function() {
              window.location.replace('${finalRelativeUrl}');
            }, 3000);
            
            // 倒计时
            let seconds = 3;
            setInterval(function() {
              seconds--;
              const el = document.getElementById('countdown');
              if (el) el.innerText = seconds;
            }, 1000);

            ${autoCheckScript}
          </script>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✓</div>
            <h2>${isChina ? '支付成功！' : 'Payment Successful!'}</h2>
            <p>${isChina ? '您的支付已完成，资金已进入托管账户。' : 'Your payment has been completed and funds are in escrow.'}</p>
            <p>${isChina ? '正在跳转到支付界面...' : 'Redirecting to payment page...'}</p>
            <div style="margin-top: 30px;">
              <a href="${finalRelativeUrl}" class="button" style="display: inline-block; margin: 10px;">${isChina ? '立即返回系统' : 'Return to System'}</a>
              <button onclick="window.location.replace('${finalRelativeUrl}')" class="button button-secondary" style="display: inline-block; margin: 10px;">${isChina ? '手动返回' : 'Manual Return'}</button>
            </div>
            <p class="countdown" style="margin-top: 20px;">${isChina ? '页面将在' : 'Page will redirect in'} <span id="countdown" style="font-weight: bold; color: #667eea;">3</span> ${isChina ? '秒后自动跳转' : 'seconds'}</p>
          </div>
        </body>
      </html>
    `

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error: any) {
    console.error('Alipay return page error:', error)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectUrl = `${baseUrl}/dashboard/tenant?tab=payments&error=unknown`
    const isChina = process.env.NEXT_PUBLIC_APP_REGION === 'china'
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${isChina ? '支付处理错误' : 'Payment Processing Error'}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }
            .container {
              background: white;
              border-radius: 12px;
              padding: 40px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 500px;
              width: 90%;
            }
            .error-icon {
              width: 80px;
              height: 80px;
              background: #ef4444;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 20px;
              font-size: 48px;
              color: white;
            }
            h2 {
              color: #1f2937;
              margin: 20px 0;
            }
            .button {
              display: inline-block;
              padding: 12px 32px;
              background: #667eea;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              margin: 20px 10px;
            }
          </style>
          <script>
            setTimeout(function() {
              window.location.href = "${redirectUrl}";
            }, 3000);
          </script>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">!</div>
            <h2>${isChina ? '处理支付时发生错误' : 'Error Processing Payment'}</h2>
            <p>${isChina ? '正在跳转到支付界面...' : 'Redirecting to payment page...'}</p>
            <a href="${redirectUrl}" class="button">${isChina ? '立即返回' : 'Return Now'}</a>
          </div>
        </body>
      </html>
    `
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  }
}
