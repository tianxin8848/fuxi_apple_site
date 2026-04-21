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
  },
});