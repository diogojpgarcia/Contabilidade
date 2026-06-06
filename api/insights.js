/**
 * api/insights.js — Vercel serverless function
 * Generates natural-language financial analysis.
 * Category-aware: non-discretionary spending (health, etc.) is handled with empathy.
 */

// Categories where increases should NEVER trigger reduction recommendations.
// The AI is instructed to acknowledge increases here with understanding, not criticism.
const NON_DISCRETIONARY = [
  'saúde','médico','médica','farmácia','farmacia','hospital','clínica','clinica',
  'dentista','dental','consulta','consultas','medicamento','medicamentos',
  'fisioterapia','optometria','seguro saúde','saude','urgência','urgencia',
  'exames','análises','analises','terapia','psicologia','psicólogo',
];

function isNonDiscretionary(name) {
  if (!name) return false;
  const n = name.toLowerCase();
  return NON_DISCRETIONARY.some(kw => n.includes(kw));
}

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

  // Classify top categories
  const catLines = topCategories.map(c => {
    const tag = isNonDiscretionary(c.name) ? ' [não-discricionária]' : '';
    return `${c.name}${tag}: ${c.amount}€ (${c.pct}%)`;
  }).join('; ') || 'sem dados';

  const nonDiscNames = topCategories
    .filter(c => isNonDiscretionary(c.name))
    .map(c => c.name);

  const savingsRateStr  = savingsRate != null ? `${savingsRate}%` : 'desconhecida';
  const trendStr        = expenseTrend != null
    ? (expenseTrend > 0 ? `+${expenseTrend}% vs mês anterior` : `${expenseTrend}% vs mês anterior`)
    : 'sem dados';
  const budgetStr       = budgetBreaches.length ? budgetBreaches.join(', ') : 'nenhum';
  const patStr          = patrimonyTotal != null ? `${patrimonyTotal.toLocaleString('pt-PT')}€` : 'não registado';
  const behavStr        = behavioralInsights.length
    ? behavioralInsights.slice(0, 5).map(i => `• ${i.title}: ${i.message}`).join('\n')
    : 'sem alertas';

  const nonDiscNote = nonDiscNames.length > 0
    ? `\nCATEGORIAS NÃO-DISCRICIONÁRIAS PRESENTES: ${nonDiscNames.join(', ')}
Estas categorias (saúde, farmácia, médico, etc.) NÃO devem ser alvo de recomendações de redução.
Se alguma delas tiver aumentado, reconhece o facto com empatia ("houve um aumento nos gastos de saúde — é natural que isso aconteça") mas nunca sugiras cortar nesses gastos.
Foca as recomendações de redução APENAS nas categorias discricionárias (lazer, restaurantes, compras, etc.).`
    : '';

  const prompt = `És um consultor de finanças pessoais experiente e humano. Analisas dados financeiros e dás conselhos diretos, honestos e acionáveis em português europeu informal — como um amigo inteligente e criterioso.

REGRAS FUNDAMENTAIS — lê com atenção antes de gerar a resposta:
• Saúde, medicamentos, consultas médicas e cuidados de saúde são NECESSIDADES. NUNCA recomendas reduzir gastos nestas áreas.
• Se uma categoria de saúde subiu, reconhece com empatia — não é uma falha financeira, é vida.
• Foca cortes e otimizações apenas em categorias verdadeiramente discricionárias (lazer, restaurantes, roupas, etc.).
• Distingue entre "gastaste mais porque precisaste" vs "gastaste mais por descuido".
• Fala como uma pessoa real, não como um relatório de gestão.
• NUNCA recomendas comprar, vender ou realocar em ativos financeiros específicos (ETFs, ações, fundos, cripto, obrigações, etc.). Não tens acesso ao estado atual dos mercados, não conheces o perfil de risco desta pessoa, e não és consultor financeiro registado. Dar timing de investimento sem este contexto é irresponsável.
• Se o tema da alocação de poupanças surgir, podes dizer que "vale a pena rever com um consultor financeiro se o dinheiro parado está a perder valor face à inflação" — mas sem nomear produtos ou dar indicações de quando/quanto investir.
• As tuas recomendações focam-se em comportamentos de despesa, poupança e orçamento — não em alocação de ativos.
${nonDiscNote}

DADOS DO PERÍODO: ${period}
━━━━━━━━━━━━━━━━━━━━━━━
Receitas:       ${income}€
Despesas:       ${expenses}€
Saldo:          ${savings}€ (taxa de poupança: ${savingsRateStr})
Tendência:      ${trendStr}
Top categorias: ${catLines}
Orçamentos ultrapassados: ${budgetStr}
Património total: ${patStr}

Alertas comportamentais:
${behavStr}
━━━━━━━━━━━━━━━━━━━━━━━

Responde APENAS com JSON válido, sem markdown, sem texto extra:
{
  "summary": "1 frase curtíssima (máx 15 palavras) que capta o essencial — direta e humana",
  "narrative": "2 a 3 frases de análise genuína com números concretos. Explica o que significam na prática. Se há gastos de saúde elevados, reconhece-os com naturalidade sem os tratar como problema.",
  "recommendations": [
    "recomendação 1 — específica e acionável, focada em categorias discricionárias",
    "recomendação 2 — específica e acionável",
    "recomendação 3 — específica e acionável"
  ],
  "outlook": "1 frase sobre o próximo mês — realista e encorajadora"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('[insights] Anthropic error:', await response.text());
      return res.status(502).json({ error: 'Claude API error' });
    }

    const data  = await response.json();
    const text  = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error('[insights] No JSON in response:', text);
      return res.status(502).json({ error: 'No JSON in response' });
    }

    return res.json(JSON.parse(match[0]));
  } catch (err) {
    console.error('[insights] Error:', err);
    return res.status(500).json({ error: err.message });
  }
};
