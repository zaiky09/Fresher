const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { port, jwtSecret, dataPath } = require('./src/config');
const { normalizeKenyanPhone } = require('./src/utils');
const { ensureStore, readStore, writeStore, createOrderId } = require('./src/store');

const storeFile = ensureStore(dataPath);
const publicDir = path.join(__dirname, 'public');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const digest = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${digest}`;
}

function verifyPassword(password, stored) {
  const [salt, digest] = stored.split(':');
  const attempted = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(attempted));
}

function createToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 12 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', jwtSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyToken(token) {
  const [body, signature] = token.split('.');
  if (!body || !signature) throw new Error('Bad token');

  const expectedSig = crypto.createHmac('sha256', jwtSecret).update(body).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) throw new Error('Bad signature');

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (Date.now() > payload.exp) throw new Error('Expired token');
  return payload;
}

function sendJson(res, statusCode, payload) {
  setCors(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  const cleanPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.normalize(path.join(publicDir, cleanPath));

  if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }

  const ext = path.extname(filePath);
  const mime = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript'
  }[ext] || 'text/plain';

  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    setCors(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === 'GET' && req.url === '/api/catalog') {
      const store = readStore(storeFile);
      return sendJson(res, 200, { products: store.products });
    }

    if (req.method === 'POST' && req.url === '/api/auth/register') {
      const { fullName, email, phone, password } = await parseBody(req);
      if (!fullName || !email || !phone || !password) {
        return sendJson(res, 400, { error: 'fullName, email, phone and password are required.' });
      }

      const normalizedPhone = normalizeKenyanPhone(phone);
      if (!normalizedPhone) {
        return sendJson(res, 400, { error: 'Use a valid Kenyan phone number e.g. 0712345678 or +254712345678.' });
      }

      const store = readStore(storeFile);
      const existingUser = store.users.find(
        (user) => user.email.toLowerCase() === email.toLowerCase() || user.phone === normalizedPhone
      );
      if (existingUser) return sendJson(res, 409, { error: 'User already exists with that email or phone number.' });

      store.users.push({
        id: `usr_${Date.now()}`,
        fullName,
        email: email.toLowerCase(),
        phone: normalizedPhone,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString()
      });
      writeStore(storeFile, store);
      return sendJson(res, 201, { message: 'Registration successful. Please log in.' });
    }

    if (req.method === 'POST' && req.url === '/api/auth/login') {
      const { emailOrPhone, password } = await parseBody(req);
      if (!emailOrPhone || !password) return sendJson(res, 400, { error: 'emailOrPhone and password are required.' });

      const store = readStore(storeFile);
      const maybePhone = normalizeKenyanPhone(emailOrPhone);
      const user = store.users.find(
        (u) => u.email === emailOrPhone.toLowerCase() || (maybePhone && u.phone === maybePhone)
      );
      if (!user || !verifyPassword(password, user.passwordHash)) return sendJson(res, 401, { error: 'Invalid credentials.' });

      const token = createToken({ sub: user.id, fullName: user.fullName, email: user.email, phone: user.phone });
      return sendJson(res, 200, { token, profile: { fullName: user.fullName, email: user.email, phone: user.phone } });
    }

    if (req.url === '/api/orders' && req.method === 'POST') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) return sendJson(res, 401, { error: 'Missing authentication token.' });

      let user;
      try { user = verifyToken(token); } catch { return sendJson(res, 401, { error: 'Invalid or expired token.' }); }

      const { items } = await parseBody(req);
      if (!Array.isArray(items) || items.length === 0) return sendJson(res, 400, { error: 'Add at least one item to place an order.' });

      const store = readStore(storeFile);
      const normalizedItems = [];
      for (const item of items) {
        const qty = Number(item.qty);
        const product = store.products.find((p) => p.id === item.productId);
        if (!product) return sendJson(res, 400, { error: `Unknown product: ${item.productId}` });
        if (!Number.isFinite(qty) || qty <= 0) return sendJson(res, 400, { error: 'Quantity must be a positive number.' });
        if (product.stock < qty) return sendJson(res, 400, { error: `Insufficient stock for ${product.name}. Available: ${product.stock}` });

        normalizedItems.push({ productId: product.id, name: product.name, unitPriceKes: product.priceKes, qty, lineTotalKes: qty * product.priceKes });
      }

      normalizedItems.forEach((line) => { store.products.find((p) => p.id === line.productId).stock -= line.qty; });
      const order = {
        id: createOrderId(),
        userId: user.sub,
        customerName: user.fullName,
        items: normalizedItems,
        totalKes: normalizedItems.reduce((sum, item) => sum + item.lineTotalKes, 0),
        status: 'Placed',
        createdAt: new Date().toISOString()
      };

      store.orders.push(order);
      writeStore(storeFile, store);
      return sendJson(res, 201, { message: 'Order placed successfully.', order });
    }

    if (req.url === '/api/orders/me' && req.method === 'GET') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) return sendJson(res, 401, { error: 'Missing authentication token.' });

      let user;
      try { user = verifyToken(token); } catch { return sendJson(res, 401, { error: 'Invalid or expired token.' }); }

      const store = readStore(storeFile);
      return sendJson(res, 200, { orders: store.orders.filter((order) => order.userId === user.sub) });
    }

    if (req.method === 'GET' && serveStatic(req, res)) return;

    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8'));
      return;
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Internal server error' });
  }
});

server.listen(port, () => {
  console.log(`Fresher app running on http://localhost:${port}`);
});
