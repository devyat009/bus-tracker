const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const geoserverBase = 'https://geoserver.semob.df.gov.br';

// Proxy for WFS -> GeoJSON
app.use('/proxy/wfs', createProxyMiddleware({
  target: geoserverBase,
  changeOrigin: true,
  pathRewrite: { '^/proxy/wfs': '/geoserver/semob/ows' },
  onProxyReq: (proxyReq) => {
    proxyReq.setHeader('accept', 'application/json');
  },
}));

// Proxy for WMS -> images
app.use('/proxy/wms', createProxyMiddleware({
  target: geoserverBase,
  changeOrigin: true,
  pathRewrite: { '^/proxy/wms': '/geoserver/semob/wms' },
}));

// Serve static files from the repo root
app.use(express.static(path.join(__dirname)));

const port = process.env.PORT || 5501;
app.listen(port, () => {
  console.log(`Dev server running at http://127.0.0.1:${port}`);
});
