const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3008;

const distDir = path.join(__dirname, 'dist');
// Default to source files for local debugging.
// Set USE_DIST=true when you explicitly want built artifacts.
const publicRoot = process.env.USE_DIST === 'true' && fs.existsSync(distDir)
  ? distDir
  : __dirname;

// Serve media assets. Production build copies img/img/ â†? dist/img/, so match
// that locally: serve img/img/ at /img/ first, then fall through to img/ for
// sub-directories like /img/logimg/ and /img/pdf/.
app.use('/img', express.static(path.join(__dirname, 'img', 'img')));
app.use('/img', express.static(path.join(__dirname, 'img')));
// é™æ€æ–‡ä»¶æœåŠ¡?¼ˆå?³é—­é»˜è®¤ index?¼Œé¿å…? "/" è¢« index.html æŠ¢å…ˆå‘½ä¸­?¼?
app.use(express.static(publicRoot, { index: false }));

// æ—?åŽç¼€URLé‡å?™è§?åˆ?
const pageRoutes = {
  '/': '/pages/index.html',
  '/products': '/pages/products.html',
  '/solutions': '/pages/solutions.html',
  '/blog': '/pages/blog.html',
  '/company': '/pages/company.html',
  '/contact': '/pages/contact.html',
  '/threatmap': '/pages/threatmap.html',
  '/outtime': '/pages/outtime.html',
};

// å¤?ç?æ—?åŽç¼€URL
Object.entries(pageRoutes).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(publicRoot, file));
  });
});

// å¤?ç?å¸¦.htmlåŽç¼€çš„URL?¼ˆé‡å®šå‘åˆ°æ—?åŽç¼€ç‰ˆæœ¬?¼?
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

// å¤?ç?æ ¹ç›®å½•çš„index.htmlé‡å®šå‘
app.get('/index.html', (req, res) => {
  res.redirect(301, '/');
});

// 404å¤?ç?
app.use((req, res) => {
  res.status(404).sendFile(path.join(publicRoot, '404.html'));
});

app.listen(port, () => {
  console.log(`ç”Ÿäº§æœåŠ¡å™¨è¿è¡Œåœ¨ http://localhost:${port}`);
  console.log(`é™æ€èµ?æºç›®å½?: ${publicRoot}`);
  console.log('æ”¯æŒçš„æ—?åŽç¼€URL:');
  Object.keys(pageRoutes).forEach(route => {
    console.log(`  ${route}`);
  });
});
