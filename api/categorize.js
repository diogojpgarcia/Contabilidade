/**
 * api/categorize.js — Vercel serverless function
 *
 * Proxies a batch categorization request to the Claude API.
 * The API key lives server-side only (ANTHROPIC_API_KEY env var in Vercel).
 *
 * POST /api/categorize
 * Body: { transactions: [{description, amount}], categories: string[] }
 * Returns: [{description, amount, category}]
 */

const { requireAuth } = require('./_auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireAuth(req, res)) return;

  const { transactions, categories } = req.body || {};

  if (!transactions?.length) {
    return res.json([]);
  }

  const prompt = `You categorize financial transactions.

INPUT:
transactions: ${JSON.stringify(transactions)}
categories: ${JSON.stringify(categories)}

GOAL:
- Clean description (lowercase, remove noise like reference numbers and codes)
- Assign best category from the provided categories list

RULES:
- Do NOT invent categories
- Be consistent
- If unsure, use "Outros"

OUTPUT:
Return ONLY a JSON array, no explanation, no markdown:
[{ "description": "cleaned text", "amount": 0, "category": "exact category name from list" }]`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[categorize] Anthropic error:', err);
      return res.status(502).json({ error: 'Claude API error' });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Extract the JSON array from the response (Claude may wrap it in prose)
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error('[categorize] No JSON array in response:', text);
      return res.status(502).json({ error: 'No JSON array in response' });
    }

    return res.json(JSON.parse(match[0]));
  } catch (err) {
    console.error('[categorize] Unexpected error:', err);
    return res.status(500).json({ error: err.message });
  }
};
