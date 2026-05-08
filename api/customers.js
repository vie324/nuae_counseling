const { requireAuth } = require('./_lib/auth');
const { fetchFromGas } = require('./_lib/gas');

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;

  try {
    const data = await fetchFromGas();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: String((err && err.message) || err) });
  }
};
