# Dockerfile for 国内版部署 (CloudBase 云托管)
# 基于 Node.js 18 LTS

FROM node:18-alpine AS base

# 安装依赖阶段
FROM base AS deps
# 使用国内镜像源加速安装
RUN npm config set registry https://registry.npmmirror.com

WORKDIR /app

# 复制依赖文件
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# 安装 pnpm（如果使用 pnpm）
RUN npm install -g pnpm --registry=https://registry.npmmirror.com

# 安装依赖
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile; \
    else \
      npm ci; \
    fi

# 构建阶段
FROM base AS builder
WORKDIR /app

# 从 deps 阶段复制 node_modules
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码
COPY . .

# 设置环境变量（构建时）
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 生成 Prisma Client（如果需要，虽然国内版主要用 CloudBase）
RUN if [ -f prisma/schema.prisma ]; then \
      npx prisma generate || echo "Prisma generate skipped"; \
    fi

# 构建 Next.js 应用
RUN npm run build || pnpm build

# 生产运行阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制必要的文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 设置权限
RUN chown -R nextjs:nodejs /app

USER nextjs

# 暴露端口（CloudBase 会自动映射）
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动应用
CMD ["node", "server.js"]
