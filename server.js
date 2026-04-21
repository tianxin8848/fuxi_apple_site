const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// 静态文件服务
app.use(express.static(path.join(__dirname, 'dist')));

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
    res.sendFile(path.join(__dirname, 'dist', file));
  });
});

// 处理带.html后缀的URL（重定向到无后缀版本）
app.get('/pages/:page.html', (req, res) => {
  const page = req.params.page;
  if (pageRoutes[`/${page}`]) {
    res.redirect(301, `/${page}`);
  } else {
    res.status(404).sendFile(path.join(__dirname, 'dist', '404.html'));
  }
});

// 处理根目录的index.html重定向
app.get('/index.html', (req, res) => {
  res.redirect(301, '/');
});

// 404处理
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'dist', '404.html'));
});

app.listen(port, () => {
  console.log(`生产服务器运行在 http://localhost:${port}`);
  console.log('支持的无后缀URL:');
  Object.keys(pageRoutes).forEach(route => {
    console.log(`  ${route}`);
  });
});