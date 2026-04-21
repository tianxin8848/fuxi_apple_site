const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3003;

const distDir = path.join(__dirname, 'dist');
// Default to source files for local debugging.
// Set USE_DIST=true when you explicitly want built artifacts.
const publicRoot = process.env.USE_DIST === 'true' && fs.existsSync(distDir)
  ? distDir
  : __dirname;

// 静态文件服务（关闭默认 index，避免 "/" 被 index.html 抢先命中）
app.use(express.static(publicRoot, { index: false }));

// 无后缀URL重写规则
const pageRoutes = {
  '/': '/pages/index.html',
  '/products': '/pages/products.html',
  '/solutions': '/pages/solutions.html',
  '/blog': '/pages/blog.html',
  '/company': '/pages/company.html',
  '/contact': '/pages/contact.html',
};

// 处理无后缀URL
Object.entries(pageRoutes).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(publicRoot, file));
  });
});

// 处理带.html后缀的URL（重定向到无后缀版本）
app.get('/pages/:page.html', (req, res) => {
  const page = req.params.page;
  if (page === 'index') {
    return res.redirect(301, '/');
  }
  if (pageRoutes[`/${page}`]) {
    return res.redirect(301, `/${page}`);
  } else {
    return res.status(404).sendFile(path.join(publicRoot, '404.html'));
  }
});

// 处理根目录的index.html重定向
app.get('/index.html', (req, res) => {
  res.redirect(301, '/');
});

// 404处理
app.use((req, res) => {
  res.status(404).sendFile(path.join(publicRoot, '404.html'));
});

app.listen(port, () => {
  console.log(`生产服务器运行在 http://localhost:${port}`);
  console.log(`静态资源目录: ${publicRoot}`);
  console.log('支持的无后缀URL:');
  Object.keys(pageRoutes).forEach(route => {
    console.log(`  ${route}`);
  });
});
