/**
 * localInsights — análise financeira gerada no dispositivo (sem IA paga, sem
 * rede, offline, privada). Recebe o resumo de buildInsightsSummary e compõe
 * uma análise profissional ancorada em frameworks reais (50/30/20, fundo de
 * emergência, metas de poupança). Mesmo formato que a análise IA, para o
 * AIInsightsPanel e o PDF a consumirem sem alterações.
 *
 * Pura e determinística.
 */

import { normalizeProfile, goalLabel } from './financialProfile.js';

const eur = (n) => `${Math.round(n || 0).toLocaleString('pt-PT')}€`;
const fmtDate = (d) => {
  if (!d) return '';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

export function generateLocalAnalysis(summary, profile = null) {
  if (!summary) return null;

  const {
    income = 0, expenses = 0, savings = 0, savingsRate = null,
    expenseTrend = null, topCategories = [], budgetDetails = [],
    categoryTrends = [], fiftyThirtyTwenty = null, emergencyMonths = null,
    dataConfidence = null,
  } = summary;

  // Perfil do utilizador → metas e ênfase personalizadas.
  const prof = normalizeProfile(profile || {});
  const target = prof.savingsTarget;          // meta de poupança escolhida (default 20)
  const emTarget = prof.variableIncome ? 6 : 3; // fundo de emergência alvo (meses)

  // ── Âncora de rendimento ──
  // Se o ordenado declarado existe e as receitas registadas estão claramente
  // abaixo (< 80%), provavelmente o extrato ainda não foi importado este mês:
  // usamos o ordenado como base fiável e avisamos que podem faltar transações.
  const declaredIncome = prof.monthlyIncome || 0;
  const incomeIncomplete = declaredIncome > 0 && income < declaredIncome * 0.8;
  const effIncome  = incomeIncomplete ? declaredIncome : income;
  const effSavings = incomeIncomplete ? declaredIncome - expenses : savings;
  const effRate    = incomeIncomplete
    ? (effIncome > 0 ? Math.round((effSavings / effIncome) * 100) : null)
    : savingsRate;

  const rate = effRate;
  const f = fiftyThirtyTwenty;
  const top = topCategories[0];
  const over = budgetDetails.filter(b => b.over);
  const onBudget = budgetDetails.filter(b => !b.over);

  // ── Resumo (1 frase com número) ──
  const summaryLine = effSavings < 0
    ? `Gastaste ${eur(-effSavings)} a mais do que recebeste este mês.`
    : rate != null
      ? `Poupaste ${rate}% do teu rendimento (${eur(effSavings)}) este mês.`
      : `Gastaste ${eur(expenses)} este mês.`;

  // ── Narrativa ──
  const trendTxt = expenseTrend == null ? ''
    : expenseTrend > 3  ? ` As despesas subiram ${expenseTrend}% face ao mês anterior.`
    : expenseTrend < -3 ? ` As despesas desceram ${Math.abs(expenseTrend)}% face ao mês anterior.`
    : ' As despesas ficaram estáveis face ao mês anterior.';
  const incomeWord = incomeIncomplete ? 'O teu ordenado é' : 'Recebeste';
  const narrative = `${incomeWord} ${eur(effIncome)} e gastaste ${eur(expenses)}, ${
    effSavings >= 0 ? `com um saldo positivo de ${eur(effSavings)}` : `com um défice de ${eur(-effSavings)}`
  }.${trendTxt}`;

  // ── Análise detalhada (50/30/20 + poupança + emergência + concentração) ──
  const d = [];
  if (f && f.needsPct != null) {
    d.push(`Pela regra 50/30/20, as necessidades estão em ${f.needsPct}% (ref. ~50%), os desejos em ${f.wantsPct}% (~30%) e a poupança em ${f.savingsPct ?? 0}% (~20%).`);
    if (f.wantsPct != null && f.wantsPct > 35) d.push(`Os gastos discricionários (${f.wantsPct}%) estão acima do recomendado — é aí que tens mais margem.`);
    else if (f.needsPct != null && f.needsPct > 60) d.push(`As necessidades pesam ${f.needsPct}% do rendimento, deixando pouca folga para poupar.`);
  }
  if (rate != null) {
    if (rate < 0) d.push('Estás a gastar mais do que ganhas — a prioridade é voltar a saldo positivo.');
    else if (rate < 10) d.push(`A taxa de poupança (${rate}%) está abaixo do mínimo saudável de 10%.`);
    else if (rate < target) d.push(`A taxa de poupança (${rate}%) é razoável mas ainda abaixo da tua meta de ${target}%.`);
    else d.push(`A taxa de poupança (${rate}%) está na tua meta de ${target}% ou acima — sólido.`);
  }
  if (emergencyMonths != null) {
    if (emergencyMonths < emTarget) d.push(`O património líquido cobre ${emergencyMonths} meses de despesas; ${prof.variableIncome ? 'com rendimento variável, aponta a 6 meses' : 'o ideal é um fundo de 3 a 6 meses'}.`);
    else if (emergencyMonths <= 6) d.push(`O fundo de emergência (${emergencyMonths} meses) está na zona recomendada.`);
    else d.push(`Tens ${emergencyMonths} meses de despesas cobertos em liquidez — reserva sólida.`);
  }
  if (top && top.pct >= 40) d.push(`A categoria ${top.name} concentra ${top.pct}% das despesas (${eur(top.amount)}) — reduzir aí tem o maior impacto.`);
  const detailedAnalysis = d.join(' ') || narrative;

  // ── Pontos fortes ──
  const strengths = [];
  if (rate != null && rate >= target) strengths.push(`Taxa de poupança de ${rate}% — na tua meta de ${target}% ou acima.`);
  if (emergencyMonths != null && emergencyMonths >= emTarget) strengths.push(`Fundo de emergência cobre ${emergencyMonths} meses de despesas.`);
  if (expenseTrend != null && expenseTrend < -5) strengths.push(`Despesas ${Math.abs(expenseTrend)}% abaixo do mês anterior.`);
  if (onBudget.length >= 2) strengths.push(`${onBudget.length} categorias dentro do orçamento definido.`);
  if (f && f.wantsPct != null && f.wantsPct <= 30 && effSavings >= 0) strengths.push(`Gastos discricionários controlados (${f.wantsPct}% do rendimento).`);

  // ── Preocupações ──
  const concerns = [];
  if (effSavings < 0) concerns.push(`Défice de ${eur(-effSavings)} este mês — insustentável a prazo.`);
  else if (rate != null && rate < 10) concerns.push(`Taxa de poupança crítica (${rate}%), abaixo de 10%.`);
  over.slice(0, 2).forEach(b => concerns.push(`${b.name}: orçamento excedido (${eur(b.spent)} de ${eur(b.budget)}).`));
  categoryTrends.forEach(t => {
    if (t.prev2 > 0 && t.curr > t.prev2 * 1.3 && t.curr > 20) {
      concerns.push(`${t.name} a subir: ${eur(t.prev2)} → ${eur(t.prev)} → ${eur(t.curr)}.`);
    }
  });
  if (emergencyMonths != null && emergencyMonths < emTarget && effSavings >= 0) {
    concerns.push(`Fundo de emergência abaixo de ${emTarget} meses (${emergencyMonths}).`);
  }

  // ── Insights por categoria ──
  const categoryInsights = topCategories.slice(0, 3).map(c => {
    const t = categoryTrends.find(x => x.name === c.name);
    let insight = `${eur(c.amount)} (${c.pct}% das despesas)`;
    if (t && t.prev > 0) {
      const dir = t.curr > t.prev ? 'a subir' : t.curr < t.prev ? 'a descer' : 'estável';
      insight += ` · ${dir} (${eur(t.prev)} → ${eur(t.curr)})`;
    }
    return { category: c.name, insight };
  });

  // ── Recomendações (acionáveis) ──
  const recommendations = [];
  if (rate != null && rate < target && effIncome > 0) {
    const gap = Math.round(effIncome * (target / 100)) - effSavings;
    if (gap > 0) recommendations.push(`Para atingir ${target}% de poupança, poupa mais ${eur(gap)}/mês.`);
  }
  if (f && f.wantsPct != null && f.wantsPct > 30) {
    recommendations.push(`Cortar 10% nos gastos discricionários liberta cerca de ${eur(f.wants * 0.10)}/mês.`);
  }
  if (over[0]) recommendations.push(`Revê o orçamento de ${over[0].name} — estás ${over[0].pct - 100}% acima do limite.`);
  if (top && top.pct >= 40) recommendations.push(`Como ${top.name} domina o orçamento, pequenas reduções aí têm grande efeito.`);
  if (emergencyMonths != null && emergencyMonths < emTarget && effSavings > 0) {
    recommendations.push(`Canaliza parte da poupança para o fundo de emergência até cobrir ${emTarget} meses.`);
  }
  if (recommendations.length === 0) {
    recommendations.push('Define orçamentos nas categorias recorrentes sem limite para consolidar o controlo.');
  }

  // Recomendação alinhada com o OBJETIVO escolhido — lidera a lista.
  const goalRec = (() => {
    switch (prof.goal) {
      case 'emergency':
        if (emergencyMonths != null && emergencyMonths < emTarget && effSavings > 0) {
          const m = Math.ceil(((emTarget - emergencyMonths) * expenses) / Math.max(effSavings, 1));
          return `Objetivo "fundo de emergência": ao ritmo de ${eur(effSavings)}/mês chegas aos ${emTarget} meses de reserva em cerca de ${m} meses.`;
        }
        return 'Objetivo "fundo de emergência": mantém a poupança a entrar para a reserva.';
      case 'debt':
        return `Objetivo "pagar dívidas": canaliza a poupança deste mês (${eur(Math.max(effSavings, 0))}) para o crédito mais caro primeiro.`;
      case 'budgets':
        return over.length > 0
          ? `Objetivo "cumprir orçamentos": tens ${over.length} categoria(s) acima do limite — começa por ${over[0].name}.`
          : 'Objetivo "cumprir orçamentos": estás dentro dos limites — define limites nas categorias que ainda não têm.';
      case 'tracking':
        return top
          ? `Objetivo "controlar gastos": ${top.name} lidera com ${top.pct}% — acompanha-a de perto.`
          : 'Objetivo "controlar gastos": regista mais transações para revelar padrões.';
      case 'growth':
        return effSavings > 0
          ? `Objetivo "crescer património": a tua margem mensal é ${eur(effSavings)} — manter o ritmo liberta capital.`
          : 'Objetivo "crescer património": recupera primeiro uma margem mensal positiva.';
      case 'savings':
      default:
        return rate != null && rate < target
          ? `Objetivo "poupar mais": faltam ${target - rate} pontos percentuais para a tua meta de ${target}%.`
          : `Objetivo "poupar mais": estás na meta de ${target}% — considera subir o alvo.`;
    }
  })();
  recommendations.unshift(goalRec);

  // ── Projeção ──
  const projections = effSavings > 0
    ? `Ao ritmo atual, em 12 meses acumularias cerca de ${eur(effSavings * 12)} em poupança.`
    : effSavings < 0
      ? `Se o défice se mantiver, em 12 meses gastarias ${eur(-effSavings * 12)} além do que recebes.`
      : '';

  // ── Perspetiva ──
  const outlook = effSavings < 0
    ? 'Foco do próximo mês: voltar a saldo positivo, começando pela maior categoria discricionária.'
    : rate != null && rate < target
      ? `Próximo mês: aproxima-te da tua meta de ${target}% de poupança — pequenos cortes somam.`
      : `Boa base — mantém o rumo para "${goalLabel(prof.goal)}".`;

  // ── Confiança nos dados (âncora de rendimento + reconciliação de saldos) ──
  const confNotes = [];
  if (incomeIncomplete) {
    confNotes.push(`Receitas registadas (${eur(income)}) abaixo do teu ordenado declarado (${eur(declaredIncome)}) — a análise usa o ordenado; podem faltar transações de receita por importar.`);
  }
  const dc = dataConfidence;
  if (dc && dc.accountsTotal > 0) {
    if (dc.accountsReconciled === 0) {
      confNotes.push('Saldos das contas por conferir — usa "Conferir saldo" no Património para aumentar a fiabilidade.');
    } else if (dc.accountsReconciled < dc.accountsTotal) {
      confNotes.push(`${dc.accountsReconciled} de ${dc.accountsTotal} contas conferidas.`);
    } else if (dc.reconciledThrough) {
      confNotes.push(`Saldos conferidos até ${fmtDate(dc.reconciledThrough)}.`);
    }
  }
  const level = incomeIncomplete
    ? 'low'
    : (dc && dc.accountsTotal > 0 && dc.accountsReconciled === 0)
      ? 'medium'
      : 'high';
  const confidence = { level, notes: confNotes };

  return {
    summary: summaryLine,
    narrative,
    detailedAnalysis,
    strengths,
    concerns,
    categoryInsights,
    recommendations,
    projections,
    outlook,
    confidence,
  };
}
