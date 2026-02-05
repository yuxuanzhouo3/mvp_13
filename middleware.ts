// 暂时禁用 middleware，确保路由正常工作
// i18n 功能通过 layout.tsx 中的 NextIntlClientProvider 实现
// 稍后如果需要路由级别的语言切换，可以恢复此 middleware

export function middleware() {
  // 暂时不做任何处理，让所有路由正常通过
}

export const config = {
  // 暂时禁用所有匹配，让路由正常工作
  matcher: []
};
