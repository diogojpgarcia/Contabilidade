/**
 * api/insights.js — Vercel serverless function
 * Generates deep natural-language financial analysis.
 * Category-aware: non-discretionary spending (health, etc.) is handled with empathy.
 */

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
    topCategories    = [],
    budgetBreaches   = [],
    budgetDetails    = [],
    categoryTrends   = [],
    txnCount,
    avgTxnSize,
    patrimonyTotal,
    behavioralInsights = [],
  } = req.body || {};

  if (!period || income == null || expenses == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // ── Format helpers ─────────────────────────────────────────────────────────
  const fmtEur = (n) => `${Math.round(n).toLocaleString('pt-PT')}€`;

  // ── Category lines ─────────────────────────────────────────────────────────
  const catLines = topCategories.map(c => {
    const tag   = isNonDiscretionary(c.name) ? ' [não-discricionária]' : '';
    const trend = categoryTrends.find(t => t.name === c.name);
    const trendStr = trend && trend.prev > 0
      ? ` | tendência 3m: ${fmtEur(trend.prev2)} → ${fmtEur(trend.prev)} → ${fmtEur(trend.curr)}`
      : '';
    return `${c.name}${tag}: ${fmtEur(c.amount)} (${c.pct}%)${trendStr}`;
  }).join('\n  ') || 'sem dados';

  // ── Budget adherence ───────────────────────────────────────────────────────
  const budgetLines = budgetDetails.length
    ? budgetDetails.map(b => {
        const status = b.over ? `⚠ EXCEDIDO ${b.pct}%` : `OK ${b.pct}%`;
        return `${b.name}: orçamento ${fmtEur(b.budget)}, gasto ${fmtEur(b.spent)} — ${status}`;
      }).join('\n  ')
    : 'sem orçamentos definidos';

  // ── Non-discretionary note ─────────────────────────────────────────────────
  const nonDiscNames = topCategories.filter(c => isNonDiscretionary(c.name)).map(c => c.name);
  const nonDiscNote  = nonDiscNames.length > 0
    ? `\nCATEGORIAS NÃO-DISCRICIONÁRIAS PRESENTES: ${nonDiscNames.join(', ')}
Estas categorias (saúde, farmácia, médico, etc.) NUNCA devem ser alvo de recomendações de redução.
Se alguma delas tiver aumentado, reconhece com empatia mas nunca sugiras cortar nesses gastos.`
    : '';

  const savingsRateStr = savingsRate != null ? `${savingsRate}%` : 'desconhecida';
  const trendStr       = expenseTrend != null
    ? (expenseTrend > 0 ? `+${expenseTrend}%` : `${expenseTrend}%`) + ' vs mês anterior'
    : 'sem dados';
  const budgetStr      = budgetBreaches.length ? budgetBreaches.join(', ') : 'nenhum';
  const patStr         = patrimonyTotal != null ? fmtEur(patrimonyTotal) : 'não registado';
  const txnStr         = txnCount != null ? `${txnCount} transações (média ${fmtEur(avgTxnSize || 0)}/transação)` : 'sem dados';
  const behavStr       = behavioralInsights.length
    ? behavioralInsights.slice(0, 6).map(i => `• ${i.title}: ${i.message}`).join('\n')
    : 'sem alertas';

  const annualSavingsProjection = savings > 0 ? Math.round(savings * 12) : null;
  const monthsOfExpensesCovered = patrimonyTotal && expenses > 0
    ? (patrimonyTotal / expenses).toFixed(1)
    : null;

  const prompt = `És um consultor de finanças pessoais sénior — rigoroso, empático, com visão analítica de um gestor de patrimónios. Analisas dados financeiros com profundidade e forneces insights que uma pessoa comum não conseguiria derivar sozinha. Falas em português europeu informal, como um amigo muito inteligente que sabe de finanças.

REGRAS FUNDAMENTAIS — lê antes de responder:
• Saúde, medicamentos, consultas médicas = NECESSIDADES. NUNCA recomendar redução. Reconhecer aumentos com empatia.
• Foca cortes APENAS em categorias discricionárias (lazer, restaurantes, roupas, etc.).
• NUNCA recomendar comprar, vender ou realocar em ativos específicos (ETFs, ações, cripto, etc.). Não tens dados de mercado nem perfil de risco.
• Se o tema poupanças surgir, podes mencionar "vale a pena rever com um consultor financeiro" — sem produtos ou timing.
• Usa números concretos em todas as análises. Generalidades não têm valor.
• Identifica padrões que não são óbvios — correlações, sazonalidade, desvios, oportunidades.
• Distingue "situação estrutural" de "evento pontual".
${nonDiscNote}

DADOS FINANCEIROS — ${period}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Receitas:       ${fmtEur(income)}
Despesas:       ${fmtEur(expenses)}
Saldo:          ${fmtEur(savings)} (taxa de poupança: ${savingsRateStr})
Tendência:      ${trendStr}
Transações:     ${txnStr}
${annualSavingsProjection ? `Projeção anual (ritmo atual): ${fmtEur(annualSavingsProjection)} em poupanças` : ''}
${monthsOfExpensesCovered ? `Cobertura de emergência: ${monthsOfExpensesCovered} meses de despesas cobertos pelo património` : ''}

TOP CATEGORIAS (com tendência 3 meses):
  ${catLines}

ADERÊNCIA AOS ORÇAMENTOS:
  ${budgetLines}
Categorias com orçamento excedido: ${budgetStr}

PATRIMÓNIO TOTAL: ${patStr}

ALERTAS COMPORTAMENTAIS (motor analítico interno):
${behavStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUÇÃO: Faz uma análise genuinamente profunda. Vai além do óbvio. Identifica padrões nas tendências de 3 meses. Avalia a estrutura de despesas. Comenta a aderência ao orçamento. Projeta consequências se os padrões continuarem. Sugere ações concretas e mensuráveis.

Responde APENAS com JSON válido, sem markdown, sem texto extra:
{
  "summary": "1 frase curtíssima (máx 15 palavras) — captura o essencial com um número",
  "narrative": "2-3 frases de análise com números concretos. O que significam na prática.",
  "detailedAnalysis": "4-5 frases de análise profunda: padrões nas tendências, estrutura de despesas, riscos estruturais vs pontuais, o que está a mudar e porquê. Usa números específicos. Fala do que o utilizador provavelmente não reparou.",
  "strengths": [
    "ponto forte 1 — específico com números",
    "ponto forte 2 — específico com números"
  ],
  "concerns": [
    "preocupação 1 — específica com dados e consequência se não corrigida",
    "preocupação 2 se existir"
  ],
  "categoryInsights": [
    {"category": "nome da categoria", "insight": "observação específica com tendência e recomendação concreta"},
    {"category": "outra categoria relevante", "insight": "observação"}
  ],
  "recommendations": [
    "recomendação 1 — ação específica e mensurável (ex: reduzir X em Y%)",
    "recomendação 2",
    "recomendação 3",
    "recomendação 4",
    "recomendação 5"
  ],
  "projections": "Se mantiveres este ritmo, em 12 meses... [projeção concreta com valores]",
  "outlook": "1 frase sobre o próximo mês — realista, encorajadora, com um foco claro"
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
        max_tokens: 2048,
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
