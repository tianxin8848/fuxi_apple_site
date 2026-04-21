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
   - `https://tasei.asia/index` 重定向到 `/`
   - `https://tasei.asia/index.html` 重定向到 `/`
   - `https://tasei.asia/pages/products.html` 重定向到 `/products`

## 故障排除

### 如果网站仍然打不开：

1. **检查构建日志**：
   - 在 Vercel Dashboard 中查看部署日志
   - 确保 `npm run build` 成功执行

2. **检查文件路径**：
   - 确保 `dist` 目录包含所有必要文件
   - 检查静态资源（CSS、JS、图片）路径是否正确

3. **检查 URL 重写**：
   - 测试各个页面的 URL
   - 确保重写规则正确匹配

### 常见错误：

1. **404 错误**：
   - 检查 `vercel.json` 中的重写规则
   - 确保目标文件存在于 `dist` 目录中

2. **构建失败**：
   - 检查 `package.json` 中的依赖
   - 确保 Node.js 版本兼容

3. **资源加载失败**：
   - 检查 HTML 文件中的资源路径
   - 确保所有资源都被复制到 `dist` 目录

## 本地测试

在部署前，可以在本地测试：

```bash
# 构建项目
npm run build

# 启动生产服务器
npm run serve

# 访问 http://localhost:3000
```

## 技术支持

如果问题仍然存在，请提供：
1. Vercel 部署日志
2. 浏览器控制台错误信息
3. 网络请求截图

## 文件说明

- `vercel.json`：Vercel 部署配置文件
- `package.json`：项目配置和脚本
- `webpack.config.prod.js`：生产环境构建配置
- `server.js`：本地开发服务器（Vercel 不使用此文件）
- `dist/`：构建输出目录（不应提交到 Git）