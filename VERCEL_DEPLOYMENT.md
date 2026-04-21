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
      "use": "@vercel/static