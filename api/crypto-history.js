/**
 * api/crypto-history.js — Vercel serverless function
 * Proxy para CoinGecko market_chart (evita CORS do browser)
 *
 * GET /api/crypto-history?coin=bitcoin&days=7
 */
const https = require('https');

function httpsGet(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.setTimeout(8000, () => { req.destroy(); resolve({ status: 408, body: '' }); });
    req.on('error', () => resolve({ status: 0, body: '' }));
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { coin, days = '7' } = req.query || {};
    if (!coin) return res.status(400).json({ error: 'coin param required' });

    const interval = days === '1' ? 'hourly' : 'daily';
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coin)}/market_chart?vs_currency=eur&days=${days}&interval=${interval}`;

    const { status, body } = await httpsGet(url);
    if (status !== 200) return res.status(200).json({ prices: [] });

    const data = JSON.parse(body);
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');
    return res.json(data);
  } catch (err) {
    console.error('[crypto-history]', err.message);
    return res.status(200).json({ prices: [] });
  }
};
