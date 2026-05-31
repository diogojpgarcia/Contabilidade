/**
 * api/euribor.js — Vercel serverless function (ES module)
 * Proxy para Euribor 3M (evita CORS do browser).
 * Tenta ECB SDMX API, com fallback para valor aproximado recente.
 *
 * GET /api/euribor
 * Returns: { rate: 2.4, source: "ecb" | "fallback" }
 */

import https from 'https';

function httpsGet(url, extraHeaders = {}) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; financas-app/1.0)',
        'Accept': 'application/vnd.sdmx.data+json;version=1.0, application/json, */*',
        ...extraHeaders,
      },
    }, (res) => {
      let body = '';
      res.on('data', d => (body += d));
      res.on('end', () => {
        console.log(`[euribor] ${url} → HTTP ${res.statusCode}, body length: ${body.length}`);
        resolve({ status: res.statusCode, body });
      });
    });
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 408, body: '' }); });
    req.on('error', (e) => {
      console.warn(`[euribor] request error: ${e.message}`);
      resolve({ status: 0, body: '' });
    });
  });
}

function parseEcbSdmxJson(body) {
  try {
    const data = JSON.parse(body);
    // Structure: dataSets[0].series["0:0:0:0:0:0:0"].observations = { "N": [value, ...] }
    const series = data?.dataSets?.[0]?.series ?? {};
    const seriesKey = Object.keys(series)[0];
    if (!seriesKey) return null;

    const observations = series[seriesKey].observations ?? {};
    const keys = Object.keys(observations).map(Number).filter(n => !isNaN(n));
    if (!keys.length) return null;

    const lastObs = observations[String(Math.max(...keys))];
    const val = Array.isArray(lastObs) ? Number(lastObs[0]) : null;
    return Number.isFinite(val) ? val : null;
  } catch (e) {
    console.warn('[euribor] parse error:', e.message);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ECB SDMX API endpoints to try (in order)
  const urls = [
    // New ECB data portal
    'https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.RT0.MM.EURIBOR3MD_.HSTA?lastNObservations=1&format=jsondata',
    // New ECB — without .HSTA variant
    'https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.RT0.MM.EURIBOR3MD_?lastNObservations=1&format=jsondata',
    // Old SDW endpoint (still accessible sometimes)
    'https://sdw-wsrest.ecb.europa.eu/service/data/FM/B.U2.EUR.RT0.MM.EURIBOR3MD_.HSTA?lastNObservations=1&format=jsondata',
    // New ECB — with explicit startPeriod (sometimes avoids 404)
    'https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.RT0.MM.EURIBOR3MD_.HSTA?startPeriod=2024-01-01&lastNObservations=1&format=jsondata',
  ];

  let rate = null;
  let source = 'ecb';

  for (const url of urls) {
    try {
      const { status, body } = await httpsGet(url);
      if (status === 200 && body.length > 50) {
        const val = parseEcbSdmxJson(body);
        if (val !== null) {
          rate = val;
          console.log(`[euribor] ✓ Euribor 3M: ${val}% (via ECB)`);
          break;
        } else {
          console.warn(`[euribor] body OK mas parse falhou. Início do body: ${body.slice(0, 200)}`);
        }
      }
    } catch (e) {
      console.warn('[euribor] erro no pedido:', e.message);
    }
  }

  // Fallback: usar valor aproximado atual se ECB não responder
  // EURIBOR 3M estava em ~2.4% em meados de 2025 e a descer gradualmente
  if (rate === null) {
    rate = 2.4; // valor aproximado — melhor que nada para cálculo de Certificados de Aforro
    source = 'fallback';
    console.warn('[euribor] ECB API indisponível — usando fallback de 2.4%');
  }

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
  return res.json({ rate, source });
}
