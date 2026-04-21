const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    liveReload: true,
    hot: true,
    open: true,
    static: [
      './',           // 根目录
      './pages',      // 页面目录
      './img',        // 图片目录
      './css',        // CSS目录
      './js'          // JS目录
    ],
    watchFiles: ['pages/**/*.html', 'img/**/*', 'css/**/*', 'js/**/*'],
    // 使用自定义中间件处理无后缀URL（在静态文件服务之前）
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer) {
        throw new Error('webpack-dev-server is not defined');
      }

      // 在中间件数组的开头插入自定义中间件
      middlewares.unshift({
        name: 'clean-url-middleware',
        // 使用更高的优先级确保在静态文件服务之前运行
        path: '/',
        middleware: (req, res, next) => {
          const url = req.url;

          // 定义页面映射
          const pageMap = {
            '/': '/pages/index.html',
            '/products': '/pages/products.html',
            '/solutions': '/pages/solutions.html',
            '/blog': '/pages/blog.html',
            '/company': '/pages/company.html',
            '/contact': '/pages/contact.html',
          };

          // 检查是否是无后缀URL
          if (pageMap[url]) {
            // 重写URL到对应的HTML文件
            req.url = pageMap[url];
            console.log(`重写URL: ${url} -> ${req.url}`);
            return next();
          }

          // 处理带.html后缀的URL（重定向到无后缀版本）
          const htmlMatch = url.match(/^\/pages\/([^/.]+)\.html$/);
          if (htmlMatch) {
            const pageName = htmlMatch[1];
            if (pageMap[`/${pageName}`]) {
              console.log(`重定向: ${url} -> /${pageName}`);
              res.writeHead(301, { 'Location': `/${pageName}` });
              res.end();
              return;
            }
          }

          next();
        }
      });

      return middlewares;
    },
  },
});
