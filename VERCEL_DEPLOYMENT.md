# Vercel 部署问题解决方案

## 当前状态
网站 `https://tasei.asia/` 返回 **404: NOT_FOUND** 错误。

## 问题根本原因

1. **构建输出结构问题**：
   - Webpack 配置错误导致重复文件：`dist/img/pages/` 和 `dist/pages/`
   - 已修复：修改 `webpack.config.prod.js` 中的 `CopyPlugin` 配置

2. **无限重定向循环**：
   - `dist/index.html` 包含 JavaScript 重定向脚本
   - 已修复：移除 `HtmlWebpackPlugin`，不再生成 `dist/index.html`

3. **错误的链接**：
   - HTML 文件中使用 `/index` 而不是 `/`
   - 已修复：运行 `fix_index_links.sh` 脚本修复所有链接

4. **Vercel 配置问题**：
   - 路由和重写规则配置不正确
   - 已修复：创建正确的 `vercel.json` 配置文件

## 已实施的修复

### 1. 修复 webpack 配置 (`webpack.config.prod.js`)
```javascript
// 修改前
{ from: 'img', to: 'img' }

// 修改后  
{ from: 'img/img', to: 'img' }
```

### 2. 修复 HTML 链接 (`fix_index_links.sh`)
```bash
# 修复所有 /index 链接为 /
sed -i '' 's|href="/index"|href="/"|g' pages/*.html
```

### 3. 创建 Vercel 配置 (`vercel.json`)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "rewrites": [
    {
      "source": "/",
      "destination": "/pages/index.html"
    },
    {
      "source": "/products",
      "destination": "/pages/products.html"
    },
    {
      "source": "/solutions",
      "destination": "/pages/solutions.html"
    },
    {
      "source": "/blog",
      "destination": "/pages/blog.html"
    },
    {
      "source": "/company",
      "destination": "/pages/company.html"
    },
    {
      "source": "/contact",
      "destination": "/pages/contact.html"
    }
  ]
}
```

## 部署步骤

### 步骤 1：提交所有更改
```bash
git add .
git commit -m "修复 Vercel 部署问题：
1. 修复 webpack 配置，避免重复文件
2. 修复 HTML 文件中的 /index 链接
3. 添加正确的 Vercel 配置文件
4. 移除导致无限重定向的 index.html"
git push
```

### 步骤 2：在 Vercel 上重新部署

#### 方法 A：通过 Vercel Dashboard
1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 找到项目 `tasei.asia`
3. 点击 "Deployments" 标签
4. 找到最新的部署，点击 "..." → "Redeploy"
5. 或者点击 "New Deployment" 重新部署

#### 方法 B：通过 Vercel CLI
```bash
# 如果已安装 Vercel CLI
vercel --prod

# 如果未安装
npm i -g vercel
vercel login
vercel --prod
```

### 步骤 3：验证部署

#### 检查构建日志
1. 在 Vercel Dashboard 中打开项目
2. 点击最新的部署
3. 查看 "Build Logs" 确保构建成功

#### 测试网站
1. 首页：`https://tasei.asia/` - 应该显示首页
2. 其他页面：
   - `https://tasei.asia/products`
   - `https://tasei.asia/solutions`
   - `https://tasei.asia/blog`
   - `https://tasei.asia/company`
   - `https://tasei.asia/contact`

## 故障排除

### 如果仍然出现 404 错误：

#### 1. 检查构建输出
```bash
# 本地构建检查
npm run build
ls -la dist/
find dist -name "*.html"
```

应该看到：
```
dist/
├── 404.html
├── css/
├── img/
├── js/
└── pages/
    ├── index.html
    ├── products.html
    ├── solutions.html
    ├── blog.html
    ├── company.html
    └── contact.html
```

#### 2. 检查 Vercel 构建日志
- 确保 `npm run build` 成功执行
- 检查是否有错误或警告

#### 3. 检查路由配置
- 确保 `vercel.json` 文件在项目根目录
- 确保配置语法正确（JSON 格式）

#### 4. 测试重写规则
可以使用浏览器开发者工具检查：
1. 打开 `https://tasei.asia/`
2. 查看网络请求
3. 检查实际请求的 URL

### 常见错误解决方案：

#### 错误 1：构建失败
```
npm ERR! missing script: build
```
解决方案：确保 `package.json` 中有 `build` 脚本

#### 错误 2：文件未找到
```
404: NOT_FOUND
```
解决方案：检查 `vercel.json` 中的重写规则路径是否正确

#### 错误 3：权限问题
解决方案：确保所有文件有正确的读写权限

## 文件清单

确保以下文件已提交：

1. `vercel.json` - Vercel 配置文件
2. `webpack.config.prod.js` - 修复后的构建配置
3. `pages/*.html` - 修复链接后的页面文件
4. `fix_index_links.sh` - 修复脚本（可选）
5. `VERCEL_DEPLOYMENT.md` - 部署指南（可选）

## 本地测试

在部署前本地测试：
```bash
# 构建项目
npm run build

# 启动服务器
npm run serve

# 访问测试
curl -I http://localhost:3000/
# 应该返回 200 OK
```

## 技术支持

如果问题仍然存在，请提供：
1. Vercel 构建日志截图
2. `dist/` 目录结构
3. 浏览器控制台错误信息
4. 网络请求截图

## 联系信息

- 项目路径：`/Users/xi/WebstormProjects/apr21-website`
- 部署域名：`https://tasei.asia/`
- 错误代码：`NOT_FOUND`
- 错误 ID：`hkg1::85p5t-1776748930141-de504f6c8971`