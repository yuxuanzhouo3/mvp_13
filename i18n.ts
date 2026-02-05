import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  // 根据环境变量自动设置语言
  const region = process.env.NEXT_PUBLIC_APP_REGION || 'global';
  const locale = region === 'china' ? 'zh' : 'en';

  try {
    return {
      locale,
      messages: (await import(`./messages/${locale}.json`)).default
    };
  } catch (error) {
    console.error('Failed to load messages:', error);
    // 降级到英文
    return {
      locale: 'en',
      messages: (await import(`./messages/en.json`)).default
    };
  }
});
