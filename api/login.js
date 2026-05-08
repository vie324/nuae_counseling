const crypto = require('crypto');
const { signToken, setAuthCookie } = require('./_lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const password = (body && body.password) || '';
  const expected = process.env.APP_PASSWORD || '';

  if (!expected) {
    res.status(500).json({ error: 'APP_PASSWORD env var is not configured' });
    return;
  }

  const a = Buffer.from(String(password));
  const b = Buffer.from(expected);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!ok) {
    await new Promise(r => setTimeout(r, 600));
    res.status(401).json({ error: 'パスワードが違います' });
    return;
  }

  const token = signToken();
  setAuthCookie(res, token);
  res.status(200).json({ ok: true });
};
