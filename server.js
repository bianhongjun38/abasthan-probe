const http = require('http');
const os = require('os');

function probe() {
  return {
    now: new Date().toISOString(),
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    cpus: os.cpus().length,
    cpuModel: (os.cpus()[0] || {}).model,
    totalMemMB: Math.round(os.totalmem() / 1048576),
    freeMemMB: Math.round(os.freemem() / 1048576),
    uptimeSec: Math.round(os.uptime()),
    loadavg: os.loadavg(),
    node: process.version,
    envKeys: Object.keys(process.env).sort(),
    port: process.env.PORT || null
  };
}

async function getText(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 6000);
  const started = Date.now();
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    const body = await r.text();
    return { url, status: r.status, ms: Date.now() - started, body: body.slice(0, 400) };
  } catch (e) {
    return { url, error: String(e && e.name || e).slice(0, 120), ms: Date.now() - started };
  } finally { clearTimeout(t); }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  if (u.pathname === '/') {
    res.end(JSON.stringify({ ok: true, probe: probe() }, null, 2));
    return;
  }
  if (u.pathname === '/egress') {
    const targets = [
      'https://api.ipify.org?format=json',
      'https://ifconfig.co/json',
      'https://ipinfo.io/json'
    ];
    const out = [];
    for (const t of targets) out.push(await getText(t, 6000));
    res.end(JSON.stringify({ egress: out }, null, 2));
    return;
  }
  if (u.pathname === '/latency') {
    const targets = [
      'https://www.google.com/generate_204',
      'https://1.1.1.1/cdn-cgi/trace',
      'https://www.cloudflare.com/cdn-cgi/trace',
      'https://github.com',
      'https://www.baidu.com'
    ];
    const out = [];
    for (const t of targets) {
      const runs = [];
      for (let i = 0; i < 3; i++) runs.push(await getText(t, 8000));
      out.push({ target: t, runs: runs.map(r => ({ ms: r.ms, status: r.status, error: r.error })) });
    }
    res.end(JSON.stringify({ latency: out }, null, 2));
    return;
  }
  res.end(JSON.stringify({ ok: false, path: u.pathname }));
});

const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => console.log('listening on ' + port));