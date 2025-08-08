const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const fetch = require('node-fetch');

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
  onError(err, req, res) {
    console.error('WFS proxy error:', err?.message || err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'WFS proxy error' }));
  },
}));

// Proxy for WMS -> images
app.use('/proxy/wms', createProxyMiddleware({
  target: geoserverBase,
  changeOrigin: true,
  pathRewrite: { '^/proxy/wms': '/geoserver/semob/wms' },
  onError(err, req, res) {
    console.error('WMS proxy error:', err?.message || err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'WMS proxy error' }));
  },
}));

// Direct fetch proxy using the exact provided URL (host allowlist)
app.get('/proxy/fetch', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: 'missing url' });
    const u = new URL(targetUrl);
    if (u.hostname !== 'geoserver.semob.df.gov.br') {
      return res.status(400).json({ error: 'host not allowed' });
    }
    const upstream = await fetch(u.toString(), { headers: { accept: 'application/json' } });
    const ct = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
    res.status(upstream.status).setHeader('content-type', ct);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    console.error('fetch proxy error:', err?.message || err);
    res.status(502).json({ error: 'fetch proxy failed' });
  }
});

// Serve static files from the repo root
app.use(express.static(path.join(__dirname)));

const port = process.env.PORT || 5501;
app.listen(port, () => {
  console.log(`Dev server running at http://127.0.0.1:${port}`);
});
