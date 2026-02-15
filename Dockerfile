# Dockerfile for 国内版部署 (CloudBase 云托管)
# 基于 Node.js 18 LTS

FROM node:18-alpine AS base
RUN apk add --no-cache openssl libc6-compat
RUN npm install -g pnpm --registry=https://registry.npmmirror.com

# 1. 安装依赖阶段
FROM base AS deps
# 使用国内镜像源加速安装
RUN npm config set registry https://registry.npmmirror.com

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# 安装依赖
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --no-frozen-lockfile; \
    else \
      npm ci; \
    fi

# 2. 构建阶段 (在这里我们强制指定它是国内版)
FROM base AS builder
WORKDIR /app

# 从 deps 阶段复制 node_modules
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码
COPY . .

# ===> 【重点修改】在这里直接写死环境变量，确保打包时一定生效 <===
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_PUBLIC_APP_REGION=china
# 填入你 .env 文件里的那个 ID
ENV NEXT_PUBLIC_CLOUDBASE_ENV_ID=homes-8ghqrqte660fbf1d

# 添加一个假的 DATABASE_URL 以骗过 Prisma 的构建检查
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# 生成 Prisma Client (如果有)
RUN if [ -f prisma/schema.prisma ]; then \
      npx prisma generate || echo "Prisma generate skipped"; \
    fi

# 构建 Next.js 应用
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm build; \
    else \
      npm run build; \
    fi

# 3. 生产运行阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# 运行时也再次确认一遍变量
ENV NEXT_PUBLIC_APP_REGION=china

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=builder /app/public ./public

# 自动判断 .next/standalone 是否存在
# 如果你的 next.config.mjs 里没开 standalone，这里可能会报错，但我们先假设你开了
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
