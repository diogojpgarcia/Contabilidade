import { isInFinancialMonth, getFinancialMonthRange, getFinancialMonthLabel, getPrediction as _getPrediction } from './financialMonth.js';
import { applyFocusBoost } from './financialFocus.js';

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export const shiftMonth = (yyyymm, delta) => {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const formatMonthLabel = (yyyymm, startDay = 1) => {
  if (startDay === 1) {
    const [y, m] = yyyymm.split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
  }
  return getFinancialMonthLabel(yyyymm, startDay);
};

export const getPrediction = (spent, selectedMonth, startDay = 1) =>
  _getPrediction(spent, selectedMonth, startDay);

const getSpent = (transactions, catName, month, startDay = 1) =>
  transactions
    .filter(t => t.type === 'expense' && t.category === catName && t.date && isInFinancialMonth(t.date, month, startDay))
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

const fmt0 = (n) =>
  Math.abs(n).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Categorias não-discricionárias — nunca sugerir redução de gastos nestas áreas
const NON_DISC_KW = [
  'saúde','saude','médico','medico','médica','medica','farmácia','farmacia',
  'hospital','clínica','clinica','dentista','dental','consulta','consultas',
  'medicamento','medicamentos','fisioterapia','optometria','seguro saúde',
  'urgência','urgencia','exames','análises','analises','terapia',
  'psicologia','psicólogo','psicologo','pediatria',
];
const isNonDisc = (label) => {
  if (!label) return false;
  const l = label.toLowerCase();
  return NON_DISC_KW.some(kw => l.includes(kw));
};

export const generateInsights = ({
  transactions, budgets, categories, selectedMonth,
  startDay = 1, focus = null, maxResults = 4,
}) => {
  const items = [];
  const prevMonth       = shiftMonth(selectedMonth, -1);
  const prev2Month      = shiftMonth(selectedMonth, -2);
  const prev3Month      = shiftMonth(selectedMonth, -3);
  const prev4Month      = shiftMonth(selectedMonth, -4);
  const prev5Month      = shiftMonth(selectedMonth, -5);
  const sameMonthLastYr = shiftMonth(selectedMonth, -12);
  const today    = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const { start, end } = getFinancialMonthRange(selectedMonth, startDay);
  const isCurrentMonth = todayStr >= start && todayStr <= end;
  const startDate   = new Date(start + 'T00:00:00');
  const endDate     = new Date(end   + 'T00:00:00');
  const daysInMonth = Math.round((endDate - startDate) / 86400000) + 1;
  const daysPassed  = isCurrentMonth ? Math.round((today - startDate) / 86400000) + 1 : daysInMonth;
  const daysLeft    = isCurrentMonth ? daysInMonth - daysPassed : 0;
  const catTotals = categories.expense.map(cat => ({
    cat,
    spent:     getSpent(transactions, cat.label, selectedMonth, startDay),
    prevSpent: getSpent(transactions, cat.label, prevMonth, startDay),
  }));
  const totalCurr = catTotals.reduce((s, c) => s + c.spent, 0);
  const currIncome = transactions
    .filter(t => t.type === 'income' && t.date && isInFinancialMonth(t.date, selectedMonth, startDay))
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const last6Months = [prev5Month, prev4Month, prev3Month, prev2Month, prevMonth, selectedMonth];

  // 1. Budget alerts
  for (const { cat, spent } of catTotals) {
    const limit   = budgets[cat.id] || 0;
    const percent = limit > 0 ? (spent / limit) * 100 : 0;
    if (limit > 0 && percent >= 100) {
      items.push({ type:'alert', priority:100, color:'risk',
        title: `${cat.label}: limite ultrapassado`,
        message: `Excedeste em ${fmt0(spent - limit)}€${daysLeft > 0 ? ` — ainda faltam ${daysLeft} dias` : ''}`,
        explanation: `${fmt0(spent)}€ gastos de um limite de ${fmt0(limit)}€`,
        meta: { action:'openBudget', categoryLabel:cat.label } });
    } else if (limit > 0 && percent >= 80) {
      items.push({ type:'risk', priority:90, color:'warn',
        title: `${cat.label}: só restam ${fmt0(limit - spent)}€`,
        message: daysLeft > 0 ? `${percent.toFixed(0)}% usado — ${daysLeft} dias ainda por decorrer` : `${percent.toFixed(0)}% do orçamento consumido`,
        explanation: `${fmt0(spent)}€ de ${fmt0(limit)}€`,
        meta: { action:'openBudget', categoryLabel:cat.label } });
    }
    if (isCurrentMonth && limit > 0 && daysPassed > 3 && percent < 100) {
      const projected = Math.round((spent / daysPassed) * daysInMonth);
      if (projected > limit) {
        items.push({ type:'alert', priority:85, color:'risk',
          title: `${cat.label}: vai ultrapassar ao ritmo atual`,
          message: `Projeção: ${fmt0(projected)}€ para um limite de ${fmt0(limit)}€`,
          explanation: `${fmt0(spent)}€ em ${daysPassed} dias — ritmo de ${fmt0(Math.round(spent / daysPassed))}€/dia`,
          meta: { action:'openBudget', categoryLabel:cat.label } });
      }
    }
  }

  // 2. Concentration
  if (totalCurr > 20) {
    const top = catTotals.filter(c => c.spent > 0).sort((a, b) => b.spent - a.spent)[0];
    if (top) {
      const share = (top.spent / totalCurr) * 100;
      if (share >= 50) {
        items.push({ type:'risk', priority:80, color: share >= 70 ? 'risk' : 'warn',
          title: `${top.cat.label} concentra ${share.toFixed(0)}% das despesas`,
          message: `${fmt0(top.spent)}€ de ${fmt0(totalCurr)}€ totais`,
          explanation: share >= 70 ? 'Concentração muito elevada — uma única categoria domina o orçamento' : 'Reduzir aqui tem o maior impacto nas poupanças totais',
          meta: { action:'openBudget', categoryLabel:top.cat.label } });
      }
    }
  }

  // 3. 3-month rise
  for (const { cat } of catTotals) {
    const m0 = getSpent(transactions, cat.label, prev2Month, startDay);
    const m1 = getSpent(transactions, cat.label, prevMonth, startDay);
    const m2 = getSpent(transactions, cat.label, selectedMonth, startDay);
    if (m0 > 10 && m1 > m0 * 1.1 && m2 > m1 * 1.1) {
      const nonDisc = isNonDisc(cat.label);
      items.push({ type:'trend', priority: nonDisc ? 40 : 75, color: nonDisc ? 'info' : 'warn',
        title: `${cat.label}: gastos a subir há 3 meses`,
        message: `${fmt0(m0)}€ → ${fmt0(m1)}€ → ${fmt0(m2)}€ (+${((m2-m0)/m0*100).toFixed(0)}%)`,
        explanation: nonDisc
          ? 'Gastos de saúde podem refletir necessidades pontuais — acompanha mas não te preocupes em reduzir.'
          : 'Tendência de aumento consistente — vale a pena definir um limite.',
        meta: { action: nonDisc ? 'openHistory' : 'openBudget', categoryLabel: cat.label } });
    }
  }

  // 4. Savings opportunity — skip non-discretionary categories
  for (const { cat } of catTotals) {
    if (isNonDisc(cat.label)) continue; // saúde, farmácia, etc. nunca são "poupança potencial"
    const m0 = getSpent(transactions, cat.label, prev2Month, startDay);
    const m1 = getSpent(transactions, cat.label, prevMonth, startDay);
    const m2 = getSpent(transactions, cat.label, selectedMonth, startDay);
    const avg2 = (m0 + m1) / 2;
    if (avg2 > 20 && m2 > avg2 * 1.3) {
      items.push({ type:'opportunity', priority:70, color:'good',
        title: `Poupança potencial em ${cat.label}`,
        message: `${fmt0(Math.round(m2 - avg2))}€ acima da tua média habitual de ${fmt0(Math.round(avg2))}€`,
        explanation: 'Voltares ao teu ritmo anterior pouparia este valor todo o mês.',
        meta: { action:'openBudget', categoryLabel:cat.label } });
    }
  }

  // 5. Biggest single expense
  if (totalCurr > 50) {
    const bigTx = transactions
      .filter(t => t.type === 'expense' && t.date && isInFinancialMonth(t.date, selectedMonth, startDay))
      .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))[0];
    if (bigTx) {
      const amt = parseFloat(bigTx.amount) || 0;
      if (amt >= 50 && amt / totalCurr >= 0.20) {
        items.push({ type:'info', priority:55, color:'info',
          title: `Maior despesa: ${fmt0(amt)}€`,
          message: `"${bigTx.description?.trim() || bigTx.category}" — ${((amt/totalCurr)*100).toFixed(0)}% do total deste mês`,
          explanation: null, meta: { action:'openHistory' } });
      }
    }
  }

  // 6. Volatility
  for (const { cat } of catTotals) {
    const monthly = last6Months.map(m => getSpent(transactions, cat.label, m, startDay)).filter(v => v > 0);
    if (monthly.length >= 4) {
      const mean   = monthly.reduce((s, v) => s + v, 0) / monthly.length;
      const stddev = Math.sqrt(monthly.reduce((s, v) => s + (v - mean) ** 2, 0) / monthly.length);
      if (stddev / mean > 0.7 && mean > 15) {
        items.push({ type:'pattern', priority:65, color:'info',
          title: `${cat.label}: gastos muito irregulares`,
          message: `De ${fmt0(Math.min(...monthly))}€ a ${fmt0(Math.max(...monthly))}€ nos últimos meses`,
          explanation: 'Padrão imprevisível — um orçamento fixo ajudaria a estabilizar',
          meta: { action:'openBudget', categoryLabel:cat.label } });
      }
    }
  }

  // 7. Weekend vs weekday
  const recentExp = transactions.filter(t => t.type === 'expense' && t.date && t.date >= prev2Month + '-01');
  if (recentExp.length >= 10) {
    let weTotal = 0, wdTotal = 0;
    const weDays = new Set(), wdDays = new Set();
    for (const t of recentExp) {
      const dow = new Date(t.date + 'T12:00:00').getDay();
      const amt = parseFloat(t.amount) || 0;
      if (dow === 0 || dow === 6) { weTotal += amt; weDays.add(t.date); }
      else { wdTotal += amt; wdDays.add(t.date); }
    }
    if (weDays.size >= 3 && wdDays.size >= 5) {
      const weAvg = weTotal / weDays.size;
      const wdAvg = wdTotal / wdDays.size;
      if (weAvg > wdAvg * 1.4) {
        items.push({ type:'pattern', priority:60, color:'info',
          title: `Gastas ${(weAvg/wdAvg).toFixed(1)}× mais ao fim de semana`,
          message: `${fmt0(weAvg)}€/dia (fim de semana) vs ${fmt0(wdAvg)}€/dia (semana)`,
          explanation: 'Padrão detetado nos últimos 3 meses',
          meta: { action:'openHistory' } });
      }
    }
  }

  // 8. Micro-transactions
  for (const { cat, spent } of catTotals) {
    if (spent < 10) continue;
    const txns = transactions.filter(t => t.type === 'expense' && t.category === cat.label && t.date && isInFinancialMonth(t.date, selectedMonth, startDay));
    if (txns.length >= 5 && spent / txns.length < 15) {
      items.push({ type:'pattern', priority:50, color:'info',
        title: `${txns.length} pequenas compras em ${cat.label}`,
        message: `Média de ${(spent/txns.length).toFixed(1)}€ cada — total: ${fmt0(spent)}€`,
        explanation: 'Pequenos gastos frequentes somam mais do que parece',
        meta: { action:'openBudget', categoryLabel:cat.label } });
    }
  }

  // 9. Savings rate
  if (currIncome > 30) {
    const sav  = currIncome - totalCurr;
    const rate = (sav / currIncome) * 100;
    if (sav < 0) {
      items.push({ type:'alert', priority:95, color:'risk',
        title: 'A gastar mais do que recebes',
        message: `Défice de ${fmt0(Math.abs(sav))}€ — receitas ${fmt0(currIncome)}€, despesas ${fmt0(totalCurr)}€`,
        explanation: 'Isto é insustentável a longo prazo — analisa onde reduzir',
        meta: { action:'openHistory' } });
    } else if (rate < 5) {
      items.push({ type:'risk', priority:88, color:'warn',
        title: `Taxa de poupança crítica: ${rate.toFixed(1)}%`,
        message: `Só ${fmt0(sav)}€ guardados de ${fmt0(currIncome)}€ de rendimento`,
        explanation: 'Objetivo recomendado: pelo menos 20%. Pequenas reduções em várias categorias podem fazer a diferença.',
        meta: { action:'openHistory' } });
    } else if (rate < 15) {
      items.push({ type:'risk', priority:72, color:'warn',
        title: `Taxa de poupança baixa: ${rate.toFixed(1)}%`,
        message: `${fmt0(sav)}€ guardados de ${fmt0(currIncome)}€`,
        explanation: `Meta saudável: 20% ou mais. Com mais 5% pouparias mais ${fmt0(currIncome * 0.05)}€/mês.`,
        meta: { action:'openHistory' } });
    } else if (rate >= 20) {
      items.push({ type:'good', priority:42, color:'good',
        title: `Taxa de poupança sólida: ${rate.toFixed(1)}%`,
        message: `${fmt0(sav)}€ poupados de ${fmt0(currIncome)}€ — acima da meta de 20%`,
        explanation: null, meta: null });
    }
  }

  // 10. Spending pace
  if (isCurrentMonth && daysPassed >= 5 && totalCurr > 50) {
    const histVals = [prevMonth, prev2Month].map(m => {
      return transactions
        .filter(t => t.type === 'expense' && t.date && isInFinancialMonth(t.date, m, startDay))
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    }).filter(v => v > 0);
    if (histVals.length >= 1) {
      const histAvg   = histVals.reduce((s, v) => s + v, 0) / histVals.length;
      const currDaily = totalCurr / daysPassed;
      const histDaily = histAvg / daysInMonth;
      const projected = Math.round(currDaily * daysInMonth);
      if (histDaily > 5 && currDaily > histDaily * 1.5) {
        items.push({ type:'alert', priority:87, color:'risk',
          title: 'Ritmo de gastos acima do normal',
          message: `${fmt0(currDaily)}€/dia atual vs ${fmt0(histDaily)}€/dia habitual`,
          explanation: `Ao ritmo atual terminarás o mês com ${fmt0(projected)}€ (habitual: ${fmt0(histAvg)}€)`,
          meta: { action:'openHistory' } });
      } else if (histDaily > 5 && currDaily < histDaily * 0.7) {
        items.push({ type:'good', priority:38, color:'good',
          title: 'Ritmo de gastos mais controlado',
          message: `${fmt0(currDaily)}€/dia vs ${fmt0(histDaily)}€/dia habitual`,
          explanation: `Ao ritmo atual poderás poupar mais ${fmt0(Math.round(histAvg - projected))}€ vs meses anteriores`,
          meta: null });
      }
    }
  }

  // 11. Year-over-year
  const lyExp = transactions
    .filter(t => t.type === 'expense' && t.date && isInFinancialMonth(t.date, sameMonthLastYr, startDay))
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  if (lyExp > 100 && totalCurr > 100) {
    const yoy = ((totalCurr - lyExp) / lyExp) * 100;
    if (yoy >= 20) {
      items.push({ type:'trend', priority:82, color:'warn',
        title: `Despesas ${yoy.toFixed(0)}% acima do ano passado`,
        message: `${fmt0(totalCurr)}€ este mês vs ${fmt0(lyExp)}€ no mesmo mês do ano anterior`,
        explanation: 'Crescimento significativo nas despesas anuais — vale a pena perceber a causa',
        meta: { action:'openHistory' } });
    } else if (yoy <= -15) {
      items.push({ type:'good', priority:44, color:'good',
        title: `Despesas ${Math.abs(yoy).toFixed(0)}% abaixo do ano passado`,
        message: `${fmt0(totalCurr)}€ vs ${fmt0(lyExp)}€ no mesmo período de ${sameMonthLastYr.split('-')[0]}`,
        explanation: `Poupaste ${fmt0(lyExp - totalCurr)}€ a mais do que no ano anterior`,
        meta: null });
    }
  }

  // 12. Recurring without budget
  for (const cat of categories.expense) {
    const active = last6Months.filter(m => getSpent(transactions, cat.label, m, startDay) > 0).length;
    const curr   = getSpent(transactions, cat.label, selectedMonth, startDay);
    if (active >= 4 && !(budgets[cat.id] > 0) && curr >= 30) {
      const avg6 = last6Months.reduce((s, m) => s + getSpent(transactions, cat.label, m, startDay), 0) / 6;
      items.push({ type:'info', priority:48, color:'info',
        title: `${cat.label}: recorrente sem limite definido`,
        message: `Ativo em ${active} dos últimos 6 meses — média de ${fmt0(avg6)}€/mês`,
        explanation: 'Definir um orçamento ajuda a controlar gastos habituais',
        meta: { action:'openBudget', categoryLabel:cat.label } });
    }
  }

  // 13. Income volatility
  const incHist = [prev5Month, prev4Month, prev3Month, prev2Month, prevMonth].map(m => {
    return transactions
      .filter(t => t.type === 'income' && t.date && isInFinancialMonth(t.date, m, startDay))
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  }).filter(v => v > 0);
  if (incHist.length >= 3) {
    const mean   = incHist.reduce((s, v) => s + v, 0) / incHist.length;
    const stddev = Math.sqrt(incHist.reduce((s, v) => s + (v - mean) ** 2, 0) / incHist.length);
    if (stddev / mean > 0.25 && mean > 200) {
      items.push({ type:'pattern', priority:63, color:'info',
        title: 'Rendimento variável detetado',
        message: `Variação de ${fmt0(Math.min(...incHist))}€ a ${fmt0(Math.max(...incHist))}€ nos últimos meses`,
        explanation: 'Com rendimento irregular, mantém uma reserva de emergência de 3-6 meses de despesas',
        meta: null });
    }
  }

  // 14. First vs second half
  if (totalCurr > 100) {
    const thisMonthTxns = transactions.filter(t => t.type === 'expense' && t.date && isInFinancialMonth(t.date, selectedMonth, startDay));
    if (thisMonthTxns.length >= 8) {
      const mStart = new Date(start + 'T00:00:00');
      let fh = 0, sh = 0;
      for (const t of thisMonthTxns) {
        const dayN = Math.round((new Date(t.date + 'T12:00:00') - mStart) / 86400000) + 1;
        if (dayN <= daysInMonth / 2) fh += parseFloat(t.amount) || 0;
        else sh += parseFloat(t.amount) || 0;
      }
      if (fh > 20 && sh > 20) {
        const ratio = fh / sh;
        if (ratio > 2) {
          items.push({ type:'pattern', priority:46, color:'info',
            title: 'Gastos concentrados no início do mês',
            message: `${fmt0(fh)}€ na 1ª metade vs ${fmt0(sh)}€ na 2ª`,
            explanation: 'Planear as compras de forma mais distribuída ajuda a controlar o orçamento',
            meta: { action:'openHistory' } });
        } else if (ratio < 0.5) {
          items.push({ type:'pattern', priority:46, color:'info',
            title: 'Gastos concentrados no fim do mês',
            message: `${fmt0(sh)}€ na 2ª metade vs ${fmt0(fh)}€ na 1ª`,
            explanation: 'Tendência de acumulação de despesas no final do mês',
            meta: { action:'openHistory' } });
        }
      }
    }
  }

  const ranked = applyFocusBoost(items, focus).sort((a, b) => b.priority - a.priority);
  return maxResults > 0 ? ranked.slice(0, maxResults) : ranked;
};

// Financial score
export const computeFinancialScore = ({ transactions, budgets, categories, selectedMonth, startDay = 1 }) => {
  const prevMonth  = shiftMonth(selectedMonth, -1);
  const prev2Month = shiftMonth(selectedMonth, -2);
  const catSpent = (label, month) =>
    transactions
      .filter(t => t.type === 'expense' && t.category === label && t.date && isInFinancialMonth(t.date, month, startDay))
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const catTotals  = categories.expense.map(cat => ({ cat, spent: catSpent(cat.label, selectedMonth) }));
  const totalCurr  = catTotals.reduce((s, c) => s + c.spent, 0);
  const totalPrev  = categories.expense.reduce((s, c) => s + catSpent(c.label, prevMonth),  0);
  const totalPrev2 = categories.expense.reduce((s, c) => s + catSpent(c.label, prev2Month), 0);
  const currIncome = transactions
    .filter(t => t.type === 'income' && t.date && isInFinancialMonth(t.date, selectedMonth, startDay))
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const withBudget = catTotals.filter(c => (budgets[c.cat.id] || 0) > 0);
  let budgetPts = 15;
  if (withBudget.length > 0) {
    const earned = withBudget.reduce((s, c) => {
      const pct = c.spent / budgets[c.cat.id];
      return s + (pct <= 0.8 ? 1 : pct <= 1.0 ? 0.4 : 0);
    }, 0);
    budgetPts = Math.round((earned / withBudget.length) * 30);
  }
  let trendPts = 15;
  if (totalPrev > 5) {
    const chg = (totalCurr - totalPrev) / totalPrev;
    trendPts = chg < -0.05 ? 25 : chg <= 0.05 ? 15 : chg <= 0.20 ? 7 : 0;
  }
  let savingsPts = 10;
  if (currIncome > 30) {
    const rate = (currIncome - totalCurr) / currIncome;
    savingsPts = rate >= 0.30 ? 25 : rate >= 0.20 ? 20 : rate >= 0.10 ? 12 : rate >= 0 ? 6 : 0;
  }
  let stabilityPts = 7;
  if (totalPrev > 5 && totalPrev2 > 5) {
    const vals = [totalPrev2, totalPrev, totalCurr];
    const mean = vals.reduce((s, v) => s + v, 0) / 3;
    const maxDev = Math.max(...vals.map(v => Math.abs(v - mean) / mean));
    stabilityPts = maxDev <= 0.15 ? 15 : maxDev <= 0.35 ? 9 : 3;
  }
  let concPts = 5;
  if (totalCurr > 20) {
    const topShare = Math.max(...catTotals.map(c => c.spent)) / totalCurr;
    concPts = topShare <= 0.30 ? 5 : topShare <= 0.50 ? 2 : 0;
  }
  const score = Math.min(100, Math.round(budgetPts + trendPts + savingsPts + stabilityPts + concPts));
  const color = score >= 80 ? '#4ade80' : score >= 60 ? '#facc15' : score >= 40 ? '#fb923c' : '#f87171';
  const label = score >= 80 ? 'Excelente controlo financeiro'
              : score >= 60 ? 'Bom controlo — há margem para melhorar'
              : score >= 40 ? 'Atenção a alguns gastos'
              : 'Gastos sob pressão — ação necessária';
  return { score, color, label };
};

// buildInsightsSummary — payload anonimizado para AI endpoint + PDF
export const buildInsightsSummary = ({ transactions, budgets, categories, patrimony, selectedMonth, startDay = 1 }) => {
  const prevMonth  = shiftMonth(selectedMonth, -1);
  const prev2Month = shiftMonth(selectedMonth, -2);

  const filterMonth = (m) => transactions.filter(t => t.date && isInFinancialMonth(t.date, m, startDay));
  const monthTxns  = filterMonth(selectedMonth);
  const prevTxns   = filterMonth(prevMonth);
  const prev2Txns  = filterMonth(prev2Month);

  const sumInc = (txns) => txns.filter(t => t.type === 'income') .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const sumExp = (txns) => txns.filter(t => t.type === 'expense').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  const income        = sumInc(monthTxns);
  const expenses      = sumExp(monthTxns);
  const savings       = income - expenses;
  const savingsRate   = income > 0 ? Math.round((savings / income) * 100) : null;
  const prevExpenses  = sumExp(prevTxns);
  const expenseTrend  = prevExpenses > 0 ? Math.round(((expenses - prevExpenses) / prevExpenses) * 100) : null;

  // Category map for current month
  const byCat = {};
  monthTxns.filter(t => t.type === 'expense').forEach(t => {
    byCat[t.category] = (byCat[t.category] || 0) + (parseFloat(t.amount) || 0);
  });

  const topCategories = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, amount]) => ({
      name,
      amount: Math.round(amount),
      pct: expenses > 0 ? Math.round((amount / expenses) * 100) : 0,
    }));

  const budgetBreaches = categories.expense
    .filter(cat => (budgets[cat.id] || 0) > 0 && byCat[cat.label] > budgets[cat.id])
    .map(cat => cat.label);

  // Budget details — categories with a defined budget
  const budgetDetails = categories.expense
    .filter(cat => (budgets[cat.id] || 0) > 0)
    .map(cat => {
      const spent  = Math.round(byCat[cat.label] || 0);
      const budget = Math.round(budgets[cat.id]);
      return { name: cat.label, budget, spent, pct: Math.round((spent / budget) * 100), over: spent > budget };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8);

  // 3-month category trends for top 4 categories
  const catAmt = (txns, label) =>
    txns.filter(t => t.type === 'expense' && t.category === label)
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  const categoryTrends = topCategories.slice(0, 4).map(c => ({
    name:  c.name,
    prev2: Math.round(catAmt(prev2Txns, c.name)),
    prev:  Math.round(catAmt(prevTxns,  c.name)),
    curr:  Math.round(catAmt(monthTxns, c.name)),
  }));

  // Transaction stats
  const expenseTxns = monthTxns.filter(t => t.type === 'expense');
  const txnCount    = expenseTxns.length;
  const avgTxnSize  = txnCount > 0 ? Math.round(expenses / txnCount) : 0;

  const patrimonyTotal = patrimony
    ? Object.values(patrimony).flat().reduce((s, item) => {
        const v = parseFloat(item?.value || item?.balance || item?.faceValue || 0);
        return s + (isNaN(v) ? 0 : v);
      }, 0)
    : null;

  return {
    period: formatMonthLabel(selectedMonth, startDay),
    income:        Math.round(income),
    expenses:      Math.round(expenses),
    savings:       Math.round(savings),
    savingsRate,
    expenseTrend,
    topCategories,
    budgetBreaches,
    budgetDetails,
    categoryTrends,
    txnCount,
    avgTxnSize,
    patrimonyTotal: patrimonyTotal ? Math.round(patrimonyTotal) : null,
  };
};
