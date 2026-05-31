/**
 * api/euribor.js — Vercel serverless function (ES module)
 * Proxy para Euribor 3M via ECB SDMX API (sem CORS do browser).
 *
 * GET /api/euribor
 * Returns: { rate: 2.4 } ou { rate: null } se falhar
 */

import https from 'https';

function httpsGet(url, headers = {}) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', ...headers },
    }, (res) => {
      let body = '';
      res.on('data', d => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 408, body: '' }); });
    req.on('error', () => resolve({ status: 0, body: '' }));
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Tenta a ECB SDMX API com múltiplos endpoints
  const urls = [
    'https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.RT0.MM.EURIBOR3MD_.HSTA?lastNObservations=1&format=jsondata',
    'https://sdw-wsrest.ecb.europa.eu/service/data/FM/B.U2.EUR.RT0.MM.EURIBOR3MD_.HSTA?lastNObservations=1&format=jsondata',
  ];

  let rate = null;

  for (const url of urls) {
    try {
      const { status, body } = await httpsGet(url, {
        'Accept': 'application/vnd.sdmx.data+json;version=1.0, application/json',
      });

      if (status !== 200 || !body) continue;

      const data = JSON.parse(body);
      const seriesKey = Object.keys(data?.dataSets?.[0]?.series ?? {})[0];
      if (!seriesKey) continue;

      const observations = data.dataSets[0].series[seriesKey].observations ?? {};
      const keys = Object.keys(observations).map(Number);
      if (!keys.length) continue;

      const lastObs = observations[String(Math.max(...keys))];
      const val = Array.isArray(lastObs) ? Number(lastObs[0]) : null;

      if (Number.isFinite(val)) {
        rate = val;
        console.log(`[euribor] taxa Euribor 3M: ${val}%`);
        break;
      }
    } catch (e) {
      console.warn('[euribor] erro:', e.message);
    }
  }

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  return res.json({ rate });
}
