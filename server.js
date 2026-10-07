// Bridge - Offline file sharing over local network
// (c) Albatany 2026
const http = require('http'), dgram = require('dgram'), fs = require('fs');
const os = require('os'), path = require('path'), crypto = require('crypto');

const PORT = +process.env.PORT || 7777, DISC = 7778;
const DIR = path.join(os.homedir(), 'Bridge');
fs.mkdirSync(DIR, { recursive: true });

const me = { id: crypto.randomBytes(4).toString('hex'), name: os.hostname(), port: PORT };
const PIN = String(crypto.randomInt(100000, 1000000));
const peers = new Map(), history = [], chats = {};
const events = new (require('events'))();
const log = (e) => { history.unshift({ ...e, time: Date.now() }); if (history.length > 100) history.pop(); };
const ifaces = () => Object.values(os.networkInterfaces()).flat()
  .filter(i => [4, 'IPv4'].includes(i.family) && !i.internal);

// ---- Device discovery (UDP broadcast) ----
const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
sock.on('message', (m, r) => {
  try {
    const p = JSON.parse(m);
    if (p.app === 'bridge' && p.id !== me.id)
      peers.set(p.id, { id: p.id, name: p.name, ip: r.address, port: p.port, seen: Date.now() });
  } catch {}
});
sock.on('error', e => console.error('Discovery error:', e.message));
sock.bind(DISC, () => {
  sock.setBroadcast(true);
  setInterval(() => {
    const msg = Buffer.from(JSON.stringify({ app: 'bridge', ...me }));
    for (const i of ifaces()) {
      const a = i.address.split('.').map(Number), m = i.netmask.split('.').map(Number);
      sock.send(msg, DISC, a.map((x, k) => x | (~m[k] & 255)).join('.'));
    }
  }, 2000);
});

// ---- HTTP server ----
const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
const body = (req, cb) => {
  let b = ''; req.on('data', c => { b += c; if (b.length > 1e6) req.destroy(); });
  req.on('end', () => { try { cb(JSON.parse(b)); } catch { cb(null); } });
};

const server = http.createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('access-control-allow-private-network', 'true');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const u = new URL(req.url, 'http://x');
  // local = UI of this device only (blocks other websites / other machines from reading the PIN)
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
    && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')
    && (!req.headers.origin || [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`].includes(req.headers.origin));
  const authed = req.headers['x-pin'] === PIN;

  if (req.method === 'GET' && u.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return fs.createReadStream(path.join(__dirname, 'public', 'index.html')).pipe(res);
  }
  if (req.method === 'GET' && u.pathname === '/api/state') {
    if (!local) return send(res, 403, { error: 'local only' });
    const live = [...peers.values()].filter(p => Date.now() - p.seen < 7000);
    return send(res, 200, { me, pin: PIN, dir: DIR, ips: ifaces().map(i => i.address), peers: live, history, chats });
  }
  if (req.method === 'POST' && u.pathname === '/api/log') {   // outgoing history (local UI only)
    if (!local) return send(res, 403, {});
    return body(req, j => { if (j) log({ type: 'out', ...j }); send(res, 200, { ok: 1 }); });
  }
  if (req.method === 'POST' && u.pathname === '/api/chat') {      // chat message from a peer
    if (!authed) return send(res, 403, { error: 'PIN salah' });
    return body(req, j => {
      if (!j || !j.id) return send(res, 400, {});
      const m = { me: false, from: String(j.from), text: String(j.text).slice(0, 2000), time: Date.now() };
      (chats[j.id] = chats[j.id] || []).push(m);
      if (chats[j.id].length > 200) chats[j.id].shift();
      events.emit('chat', m); send(res, 200, { ok: 1 });
    });
  }
  if (req.method === 'POST' && u.pathname === '/api/chatlog') {   // my own sent message (local UI only)
    if (!local) return send(res, 403, {});
    return body(req, j => {
      if (j && j.id) (chats[j.id] = chats[j.id] || []).push({ me: true, text: String(j.text).slice(0, 2000), time: Date.now() });
      send(res, 200, { ok: 1 });
    });
  }
  if (req.method === 'POST' && u.pathname === '/api/text') {  // text / clipboard from a peer
    if (!authed) return send(res, 403, { error: 'PIN salah' });
    return body(req, j => {
      if (!j) return send(res, 400, {});
      log({ type: 'in', kind: 'text', text: String(j.text).slice(0, 100000), peer: j.from });
      send(res, 200, { ok: 1 });
    });
  }
  if (req.method === 'PUT' && u.pathname === '/api/file') {   // streamed upload, no size limit
    if (!authed) return send(res, 403, { error: 'PIN salah' });
    const parts = (u.searchParams.get('name') || '').split(/[\\/]/).filter(p => p && p !== '.' && p !== '..');
    let dest = path.join(DIR, ...parts);
    if (!parts.length || !dest.startsWith(DIR + path.sep)) return send(res, 400, { error: 'nama tidak valid' });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(dest)) { const x = path.parse(dest); dest = path.join(x.dir, `${x.name}-${Date.now()}${x.ext}`); }
    const out = fs.createWriteStream(dest); let n = 0;
    req.on('data', c => n += c.length);
    req.on('aborted', () => { out.destroy(); fs.unlink(dest, () => {}); });
    out.on('error', () => send(res, 500, { error: 'gagal menulis file' }));
    out.on('finish', () => {
      log({ type: 'in', kind: 'file', name: parts.join('/'), size: n, peer: u.searchParams.get('from') });
      events.emit('file', { from: u.searchParams.get('from') || '?', name: parts.join('/') });
      send(res, 200, { ok: 1 });
    });
    return req.pipe(out);
  }
  send(res, 404, { error: 'not found' });
});
server.on('error', e => console.error('Server error:', e.message));
server.requestTimeout = 0;   // large files may take longer than the default timeout
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  BRIDGE  (c) Albatany 2026\n  Buka  : http://localhost:${PORT}\n  Simpan: ${DIR}\n  PIN   : ${PIN}\n`);
});

module.exports = { events };
