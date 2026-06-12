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
      { directory: './', publicPath: '/' },                 // 根目�?
      { directory: './img/pdf', publicPath: '/img/pdf' },  // 与�?�目录�? img/pdf 一致?��避免�? /img �? img/img 冲突时取错�?件
      { directory: './pages', publicPath: '/pages' },       // 页面目�?
      { directory: './img/img', publicPath: '/img' },       // 统一图片URL前缀
      { directory: './css', publicPath: '/css' },           // CSS目�?
      { directory: './js', publicPath: '/js' }              // JS目�?
    ],
    watchFiles: ['pages/**/*.html', 'img/**/*', 'css/**/*', 'js/**/*'],
    // 使用自定义中间件�?�?�?后缀URL?��在静态文件服务之前?�?
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer) {
        throw new Error('webpack-dev-server is not defined');
      }

      // 在中间件数�?�?开头插�?�自定义中间件
      middlewares.unshift({
        name: 'clean-url-middleware',
        // 使用更高的优�?�级确保在静态文件服务之前运�?
        path: '/',
        middleware: (req, res, next) => {
          const url = req.url;

          // 定义页面�?�?
          const pageMap = {
            '/': '/pages/index.html',
            '/products': '/pages/products.html',
            '/solutions': '/pages/solutions.html',
            '/blog': '/pages/blog.html',
            '/company': '/pages/company.html',
            '/contact': '/pages/contact.html',
            '/threatmap': '/pages/threatmap.html',
            '/outtime': '/pages/outtime.html',
          };

          // 检查是否是�?后缀URL
          if (pageMap[url]) {
            // 重�?�URL到对应的HTML�?件
            req.url = pageMap[url];
            console.log(`重�?�URL: ${url} -> ${req.url}`);
            return next();
          }

          // �?�?带.html后缀的URL?��重定向到�?后缀版本?�?
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
