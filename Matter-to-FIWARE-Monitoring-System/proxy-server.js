const http = require('http');

// CORS proxy for Orion context broker
const proxy = http.createServer((req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Forward only Orion-relevant routes used by dashboard and tests
  const allowPrefix = req.url.startsWith('/v2/');
  const allowVersion = req.method === 'GET' && req.url === '/version';

  if (allowPrefix || allowVersion) {
    console.log(`Proxying ${req.method} ${req.url} to http://localhost:1026${req.url}`);

    const options = {
      hostname: 'localhost',
      port: 1026,
      path: req.url,
      method: req.method,
      headers: req.headers
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (error) => {
      console.error('Proxy request error:', error.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Gateway', message: error.message }));
    });

    // Pipe request body for POST/PATCH/PUT
    req.pipe(proxyReq);
    return;
  }

  // Handle other requests
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

const PORT = 3001;
proxy.listen(PORT, '0.0.0.0', () => {
  console.log('CORS Proxy Server listening on port ' + PORT);
  console.log('Proxying /version and /v2/* to http://localhost:1026');
});

proxy.on('error', (error) => {
  console.error('Server error:', error.message);
});
