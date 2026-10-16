/*
 * Minimal local web server for the WSTG Checklist.
 *   node server.js            -> http://127.0.0.1:8080
 *   node server.js 3000       -> http://127.0.0.1:3000
 * Zero dependencies. Listens on loopback only and serves a fixed allowlist of files.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HOST = '127.0.0.1';
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const ROOT = __dirname;

// Only these files are ever served; nothing else in the folder is reachable.
const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/wstg-data.js': ['wstg-data.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8']
};

// Allow index.html's inline theme script by hash instead of 'unsafe-inline'.
function inlineScriptHashes() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const hashes = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    hashes.push("'sha256-" + crypto.createHash('sha256').update(m[1], 'utf8').digest('base64') + "'");
  }
  return hashes.join(' ');
}

function securityHeaders() {
  return {
    'Content-Security-Policy': [
      "default-src 'none'",
      "script-src 'self' " + inlineScriptHashes(),
      "style-src 'self' 'unsafe-inline'", // progress bars use inline style attributes
      "img-src 'self' data:",
      "connect-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'"
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cache-Control': 'no-cache'
  };
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const entry = FILES[pathname];
  if (!entry) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }
  fs.readFile(path.join(ROOT, entry[0]), (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Could not read ' + entry[0]);
    }
    res.writeHead(200, Object.assign({ 'Content-Type': entry[1], 'Content-Length': data.length }, securityHeaders()));
    res.end(req.method === 'HEAD' ? undefined : data);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`Port ${PORT} is already in use. Try: node server.js ${PORT + 1}`);
  else console.error(err.message);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`WSTG Checklist running at http://${HOST}:${PORT}  (Ctrl+C to stop)`);
});
