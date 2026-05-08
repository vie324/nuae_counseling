const crypto = require('crypto');

const COOKIE_NAME = 'nuae_auth';
const TTL_HOURS = 12;
const TTL_MS = TTL_HOURS * 60 * 60 * 1000;
const TTL_SECONDS = TTL_HOURS * 60 * 60;

function getSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET env var must be set (>=16 chars)');
  }
  return s;
}

function hmac(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
}

function signToken() {
  const exp = String(Date.now() + TTL_MS);
  return `${exp}.${hmac(exp)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = hmac(payload);
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const exp = parseInt(payload, 10);
  if (!exp || exp < Date.now()) return false;
  return true;
}

function getCookie(req, name) {
  const header = req.headers && req.headers.cookie;
  if (!header) return null;
  const parts = header.split(';');
  for (const part of parts) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function setAuthCookie(res, token) {
  const isProd = process.env.VERCEL_ENV === 'production';
  const attrs = [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    `Max-Age=${TTL_SECONDS}`
  ];
  if (isProd) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`);
}

function requireAuth(req, res) {
  const token = getCookie(req, COOKIE_NAME);
  if (!verifyToken(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

module.exports = {
  COOKIE_NAME,
  signToken,
  verifyToken,
  getCookie,
  setAuthCookie,
  clearAuthCookie,
  requireAuth
};
