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

const { requireAuth } = require('./_auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await requireAuth(req, res))) return;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[insights] ANTHROPIC_API_KEY ausente nos env vars do Vercel');
    return res.status(500).json({ error: 'IA não configurada no servidor (falta ANTHROPIC_API_KEY)' });
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
    fiftyThirtyTwenty = null,
    emergencyMonths   = null,
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
• NÃO inventes estatísticas, percentis, médias nacionais nem estudos específicos. Ancora-te apenas em frameworks reconhecidos (abaixo) e nos números reais do utilizador.

FRAMEWORKS DE REFERÊNCIA (usa-os para dar profundidade profissional):
• Regra 50/30/20 — ~50% do rendimento em necessidades, ~30% em desejos, ~20% em poupança. Avalia em que medida a estrutura de despesas se aproxima ou afasta disto.
• Fundo de emergência — 3 a 6 meses de despesas em reserva líquida. Comenta a cobertura atual se houver dados de património.
• Taxa de poupança — 20% é a meta saudável; abaixo de 10% é frágil; acima de 30% é forte.
• Regra dos 4% / horizonte longo — só mencionar de forma genérica se relevante, sem recomendar produtos.
${nonDiscNote}

DADOS FINANCEIROS — ${period}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Receitas:       ${fmtEur(income)}
Despesas:       ${fmtEur(expenses)}
Saldo:          ${fmtEur(savings)} (taxa de poupança: ${savingsRateStr})
Tendência:      ${trendStr}
Transações:     ${txnStr}
${annualSavingsProjection ? `Projeção anual (ritmo atual): ${fmtEur(annualSavingsProjection)} em poupanças` : ''}
${fiftyThirtyTwenty ? `Estrutura 50/30/20 (real): necessidades ${fmtEur(fiftyThirtyTwenty.needs)} (${fiftyThirtyTwenty.needsPct ?? '?'}% do rendimento) · desejos ${fmtEur(fiftyThirtyTwenty.wants)} (${fiftyThirtyTwenty.wantsPct ?? '?'}%) · poupança ${fiftyThirtyTwenty.savingsPct ?? '?'}%` : ''}
${(emergencyMonths ?? monthsOfExpensesCovered) ? `Cobertura de emergência: ${emergencyMonths ?? monthsOfExpensesCovered} meses de despesas cobertos pelo património (meta 3-6 meses)` : ''}

TOP CATEGORIAS (com tendência 3 meses):
  ${catLines}

ADERÊNCIA AOS ORÇAMENTOS:
  ${budgetLines}
Categorias com orçamento excedido: ${budgetStr}

PATRIMÓNIO TOTAL: ${patStr}

ALERTAS COMPORTAMENTAIS (motor analítico interno):
${behavStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUÇÃO: Faz uma análise genuinamente profunda, ao nível de um relatório de consultor financeiro. Vai além do óbvio:
• Avalia a estrutura de despesas à luz da regra 50/30/20 (estima necessidades vs desejos a partir das categorias) e diz onde está o desvio.
• Compara a taxa de poupança com as metas (10% frágil / 20% saudável / 30% forte) e quantifica o que falta para a próxima meta.
• Se houver património, avalia a cobertura do fundo de emergência (meta 3-6 meses de despesas) e diz quantos meses faltam.
• Identifica padrões nas tendências de 3 meses — o que está a mudar e porquê (estrutural vs pontual).
• Projeta consequências concretas a 12 meses se os padrões continuarem.
• Sugere ações específicas e mensuráveis (ex: reduzir X em Y€/mês liberta Z€/ano).

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
        model:         'claude-sonnet-4-6',
        max_tokens:    3000,
        stream:        true,                 // stream incremental para o cliente
        output_config: { effort: 'medium' }, // GA no Sonnet 4.6 — equilíbrio qualidade/latência
        messages:      [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('[insights] Anthropic error:', await response.text());
      return res.status(502).json({ error: 'Claude API error' });
    }

    // Faz pipe dos text deltas (SSE da Anthropic) para o cliente em texto simples.
    // O cliente acumula e faz o parse do JSON final (ver useAIInsights).
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // guarda a última linha (possivelmente parcial)
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            res.write(evt.delta.text);
          }
        } catch { /* keep-alive / linha SSE parcial — ignora */ }
      }
    }
    return res.end();
  } catch (err) {
    console.error('[insights] Error:', err);
    if (!res.headersSent) return res.status(500).json({ error: err.message });
    return res.end();
  }
};
