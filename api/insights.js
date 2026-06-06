/**
 * api/insights.js — Vercel serverless function
 *
 * Generates a natural-language financial analysis for the user's period data.
 * Receives only aggregated/anonymised statistics (no raw transaction descriptions).
 *
 * POST /api/insights
 * Body: {
 *   period, income, expenses, savings, savingsRate, expenseTrend,
 *   topCategories: [{name, amount, pct}],
 *   budgetBreaches: string[],
 *   patrimonyTotal: number | null,
 *   behavioralInsights: [{title, message}]   ← top behavioral flags, no personal data
 * }
 * Returns: { summary, narrative, recommendations, outlook }
 */

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    period,
    income,
    expenses,
    savings,
    savingsRate,
    expenseTrend,
    topCategories = [],
    budgetBreaches = [],
    patrimonyTotal,
    behavioralInsights = [],
  } = req.body || {};

  if (!period || income == null || expenses == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const savingsRateStr   = savingsRate != null ? `${savingsRate}%` : 'desconhecida';
  const expenseTrendStr  = expenseTrend != null
    ? (expenseTrend > 0 ? `+${expenseTrend}% vs mês anterior` : `${expenseTrend}% vs mês anterior`)
    : 'sem dados de comparação';
  const topCatsStr       = topCategories.length
    ? topCategories.map(c => `${c.name}: ${c.amount}€ (${c.pct}%)`).join('; ')
    : 'sem dados';
  const budgetStr        = budgetBreaches.length
    ? budgetBreaches.join(', ')
    : 'nenhum orçamento ultrapassado';
  const patStr           = patrimonyTotal != null
    ? `${patrimonyTotal.toLocaleString('pt-PT')}€`
    : 'não registado';
  const behavStr         = behavioralInsights.length
    ? behavioralInsights.slice(0, 5).map(i => `• ${i.title}: ${i.message}`).join('\n')
    : 'sem alertas adicionais';

  const prompt = `És um consultor de finanças pessoais experiente. Analisas dados financeiros e dás conselhos diretos, honestos e acionáveis em português europeu informal — como um amigo inteligente e criterioso, não como um robot.

DADOS DO PERÍODO: ${period}
━━━━━━━━━━━━━━━━━━━━━━━
Receitas:       ${income}€
Despesas:       ${expenses}€
Saldo:          ${savings}€ (taxa de poupança: ${savingsRateStr})
Tendência:      ${expenseTrendStr}
Top categorias: ${topCatsStr}
Orçamentos ultrapassados: ${budgetStr}
Património total (estimativa): ${patStr}

Alertas comportamentais detetados:
${behavStr}
━━━━━━━━━━━━━━━━━━━━━━━

Responde APENAS com um JSON válido, sem mais nada, sem markdown, sem \`\`\`:
{
  "summary": "1 frase curtíssima (máx 15 palavras) que capta o essencial deste mês — direta e sem rodeios",
  "narrative": "2 a 3 frases de análise genuína. Refere números concretos. Explica o que eles significam na prática — não só o que são, mas o que implicam. Fala como uma pessoa, não como um relatório.",
  "recommendations": [
    "recomendação 1 — específica, com número ou ação concreta",
    "recomendação 2 — específica, com número ou ação concreta",
    "recomendação 3 — específica, com número ou ação concreta"
  ],
  "outlook": "1 frase sobre o que deve acontecer no próximo mês para melhorar, ou o que manter se correu bem"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':          process.env.ANTHROPIC_API_KEY,
        'anthropic-version':  '2023-06-01',
        'content-type':       'application/json',
      },
      body: JSON.stringify({
        model:      'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[insights] Anthropic error:', err);
      return res.status(502).json({ error: 'Claude API error' });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Extract JSON from response (Claude may occasionally add surrounding text)
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error('[insights] No JSON object in response:', text);
      return res.status(502).json({ error: 'No JSON in response' });
    }

    const parsed = JSON.parse(match[0]);
    return res.json(parsed);
  } catch (err) {
    console.error('[insights] Unexpected error:', err);
    return res.status(500).json({ error: err.message });
  }
};
