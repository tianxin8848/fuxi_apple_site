# Vercel 部署指南

## 问题诊断

你的网站 `https://tasei.asia/` 在 Vercel 上打不开的原因：

1. **缺少 Vercel 配置文件**：项目没有 `vercel.json` 配置文件
2. **URL 重写问题**：项目使用无后缀 URL（如 `/products` 而不是 `/products.html`）
3. **链接不一致**：部分链接使用 `/index` 而不是 `/`

## 已修复的问题

### 1. 创建了 Vercel 配置文件 (`vercel.json`)

配置文件包含：
- 静态构建配置（使用 `@vercel/static-build`）
- URL 重写规则，支持无后缀 URL
- 处理 `/index` 到 `/` 的重定向

### 2. 更新了 package.json

添加了 `vercel-build` 脚本，Vercel 会自动执行此脚本进行构建。

## 部署步骤

### 方法一：通过 Vercel Dashboard 部署

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "New Project"
3. 导入你的 GitHub/GitLab 仓库
4. Vercel 会自动检测配置并部署

### 方法二：通过 Vercel CLI 部署

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 生产环境部署
vercel --prod
```

### 方法三：通过 Git 推送自动部署

1. 确保 `vercel.json` 文件已提交到仓库
2. 连接你的 Git 仓库到 Vercel
3. 每次推送到主分支时自动部署

## 验证部署

部署后，检查以下内容：

1. **首页**：`https://tasei.asia/` 应该正常显示
2. **无后缀 URL**：
   - `https://tasei.asia/products`
   - `https://tasei.asia/solutions`
   - `https://tasei.asia/blog`
   - `https://tasei.asia/company`
   - `https://tasei.asia/contact`
3. **重定向**：
   - `https://tasei.asia/index` 重定向到 `/