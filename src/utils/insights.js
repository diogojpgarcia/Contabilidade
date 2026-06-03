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

// Re-export so callers that import getPrediction from insights still work.
export const getPrediction = (spent, selectedMonth, startDay = 1) =>
  _getPrediction(spent, selectedMonth, startDay);

const getSpent = (transactions, catName, month, startDay = 1) =>
  transactions
    .filter(t => t.type === 'expense' && t.category === catName && t.date && isInFinancialMonth(t.date, month, startDay))
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

const fmt0 = (n) =>
  Math.abs(n).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const generateInsights = ({ transactions, budgets, categories, selectedMonth, startDay = 1, focus = null }) => {
  const items = [];

  const prevMonth  = shiftMonth(selectedMonth, -1);
  const prev2Month = shiftMonth(selectedMonth, -2);
  const prev3Month = shiftMonth(selectedMonth, -3);
  const prev4Month = shiftMonth(selectedMonth, -4);
  const prev5Month = shiftMonth(selectedMonth, -5);

  // Current period timing (works for both calendar and financial months)
  const today    = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const { start, end } = getFinancialMonthRange(selectedMonth, startDay);
  const isCurrentMonth = todayStr >= start && todayStr <= end;
  const startDate  = new Date(start + 'T00:00:00');
  const endDate    = new Date(end   + 'T00:00:00');
  const daysInMonth  = Math.round((endDate - startDate) / 86400000) + 1;
  const daysPassed   = isCurrentMonth ? Math.round((today - startDate) / 86400000) + 1 : daysInMonth;
  const daysLeft     = isCurrentMonth ? daysInMonth - daysPassed : 0;

  // Per-category current + previous month totals
  const catTotals = categories.expense.map(cat => ({
    cat,
    spent:     getSpent(transactions, cat.label, selectedMonth, startDay),
    prevSpent: getSpent(transactions, cat.label, prevMonth,     startDay),
  }));
  const totalCurr = catTotals.reduce((s, c) => s + c.spent, 0);

  // ── 1. Budget alerts ───────────────────────────────────────────────────────
  for (const { cat, spent } of catTotals) {
    const limit   = budgets[cat.id] || 0;
    const percent = limit > 0 ? (spent / limit) * 100 : 0;

    if (limit > 0 && percent >= 100) {
      items.push({
        type: 'alert',
        title: `${cat.label}: limite ultrapassado`,
        message: `Excedeste em ${fmt0(spent - limit)}€${daysLeft > 0 ? ` — ainda faltam ${daysLeft} dias` : ''}`,
        explanation: `${fmt0(spent)}€ gastos de um limite de ${fmt0(limit)}€`,
        priority: 100,
        color: 'risk',
        meta: { action: 'openBudget', categoryLabel: cat.label },
      });
    } else if (limit > 0 && percent >= 80) {
      const remaining = limit - spent;
      items.push({
        type: 'risk',
        title: `${cat.label}: só restam ${fmt0(remaining)}€`,
        message: daysLeft > 0
          ? `${percent.toFixed(0)}% usado — ${daysLeft} dias ainda por decorrer`
          : `${percent.toFixed(0)}% do orçamento consumido`,
        explanation: `${fmt0(spent)}€ de ${fmt0(limit)}€`,
        priority: 90,
        color: 'warn',
        meta: { action: 'openBudget', categoryLabel: cat.label },
      });
    }

    // Projection: current pace → end of month
    if (isCurrentMonth && limit > 0 && daysPassed > 3 && percent < 100) {
      const projected = Math.round((spent / daysPassed) * daysInMonth);
      if (projected > limit) {
        items.push({
          type: 'alert',
          title: `${cat.label}: vai ultrapassar ao ritmo atual`,
          message: `Projeção: ${fmt0(projected)}€ para um limite de ${fmt0(limit)}€`,
          explanation: `${fmt0(spent)}€ em ${daysPassed} dias — ritmo de ${fmt0(Math.round(spent / daysPassed))}€/dia`,
          priority: 85,
          color: 'risk',
          meta: { action: 'openBudget', categoryLabel: cat.label },
        });
      }
    }
  }

  // ── 2. Category concentration ──────────────────────────────────────────────
  if (totalCurr > 20) {
    const topCat = catTotals.filter(c => c.spent > 0).sort((a, b) => b.spent - a.spent)[0];
    if (topCat) {
      const share = (topCat.spent / totalCurr) * 100;
      if (share >= 50) {
        items.push({
          type: 'risk',
          title: `${topCat.cat.label} concentra ${share.toFixed(0)}% das despesas`,
          message: `${fmt0(topCat.spent)}€ de ${fmt0(totalCurr)}€ totais`,
          explanation: share >= 70
            ? 'Concentração muito elevada — uma única categoria domina o orçamento'
            : 'Reduzir aqui tem o maior impacto nas poupanças totais',
          priority: 80,
          color: share >= 70 ? 'risk' : 'warn',
          meta: { action: 'openBudget', categoryLabel: topCat.cat.label },
        });
      }
    }
  }

  // ── 3. 3-month consecutive increase in a category ─────────────────────────
  for (const { cat } of catTotals) {
    const [m0, m1, m2] = [prev2Month, prevMonth, selectedMonth]
      .map(m => getSpent(transactions, cat.label, m, startDay));
    if (m0 > 10 && m1 > m0 * 1.1 && m2 > m1 * 1.1) {
      const growth = ((m2 - m0) / m0 * 100).toFixed(0);
      items.push({
        type: 'trend',
        title: `${cat.label} sobe há 3 meses seguidos`,
        message: `${fmt0(m0)}€ → ${fmt0(m1)}€ → ${fmt0(m2)}€  (+${growth}%)`,
        explanation: 'Tendência de aumento consistente — vale a pena definir um limite',
        priority: 75,
        color: 'warn',
        meta: { action: 'openBudget', categoryLabel: cat.label },
      });
    }
  }

  // ── 4. Savings opportunity — spending above 2-month average by > 30% ───────
  for (const { cat } of catTotals) {
    const [m0, m1, m2] = [prev2Month, prevMonth, selectedMonth]
      .map(m => getSpent(transactions, cat.label, m, startDay));
    const avg2 = (m0 + m1) / 2;
    if (avg2 > 20 && m2 > avg2 * 1.3) {
      const excess = Math.round(m2 - avg2);
      items.push({
        type: 'opportunity',
        title: `Poupança potencial em ${cat.label}`,
        message: `${fmt0(excess)}€ acima da tua média habitual de ${fmt0(Math.round(avg2))}€`,
        explanation: 'Voltares ao teu ritmo anterior pouparia este valor todo o mês',
        priority: 70,
        color: 'good',
        meta: { action: 'openBudget', categoryLabel: cat.label },
      });
    }
  }

  // ── 5. Biggest single expense this month ──────────────────────────────────
  if (totalCurr > 50) {
    const thisMonthExpenses = transactions.filter(
      t => t.type === 'expense' && t.date && isInFinancialMonth(t.date, selectedMonth, startDay)
    ).sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
    const bigTx = thisMonthExpenses[0];
    if (bigTx) {
      const amt = parseFloat(bigTx.amount) || 0;
      const share = amt / totalCurr;
      if (amt >= 50 && share >= 0.20) {
        const label = bigTx.description?.trim() || bigTx.category;
        items.push({
          type: 'info',
          title: `Maior despesa: ${fmt0(amt)}€`,
          message: `"${label}" — ${(share * 100).toFixed(0)}% do total deste mês`,
          explanation: null,
          priority: 55,
          color: 'info',
          meta: { action: 'openHistory' },
        });
      }
    }
  }

  // ── 6. Spending volatility ─────────────────────────────────────────────────
  for (const { cat } of catTotals) {
    const monthly = [prev5Month, prev4Month, prev3Month, prev2Month, prevMonth, selectedMonth]
      .map(m => getSpent(transactions, cat.label, m, startDay))
      .filter(v => v > 0);
    if (monthly.length >= 4) {
      const mean   = monthly.reduce((s, v) => s + v, 0) / monthly.length;
      const stddev = Math.sqrt(monthly.reduce((s, v) => s + (v - mean) ** 2, 0) / monthly.length);
      const cv     = stddev / mean;
      if (cv > 0.7 && mean > 15) {
        const min = fmt0(Math.min(...monthly));
        const max = fmt0(Math.max(...monthly));
        items.push({
          type: 'pattern',
          title: `${cat.label}: gastos muito irregulares`,
          message: `De ${min}€ a ${max}€ nos últimos meses`,
          explanation: 'Padrão imprevisível — um orçamento fixo ajudaria a estabilizar',
          priority: 65,
          color: 'info',
          meta: { action: 'openBudget', categoryLabel: cat.label },
        });
      }
    }
  }

  // ── 7. Weekend vs weekday spending pattern ─────────────────────────────────
  const windowStart = prev2Month + '-01';
  const recentExpenses = transactions.filter(
    t => t.type === 'expense' && t.date && t.date >= windowStart
  );
  if (recentExpenses.length >= 10) {
    let weekendTotal = 0; const weekendDays = new Set();
    let weekdayTotal = 0; const weekdayDays = new Set();
    for (const t of recentExpenses) {
      const dow    = new Date(t.date + 'T12:00:00').getDay();
      const amount = parseFloat(t.amount) || 0;
      if (dow === 0 || dow === 6) { weekendTotal += amount; weekendDays.add(t.date); }
      else                        { weekdayTotal += amount; weekdayDays.add(t.date); }
    }
    if (weekendDays.size >= 3 && weekdayDays.size >= 5) {
      const wkendAvg = weekendTotal / weekendDays.size;
      const wkdayAvg = weekdayTotal / weekdayDays.size;
      if (wkendAvg > wkdayAvg * 1.4) {
        const ratio = (wkendAvg / wkdayAvg).toFixed(1);
        items.push({
          type: 'pattern',
          title: `Gastas ${ratio}× mais ao fim de semana`,
          message: `${fmt0(wkendAvg)}€/dia (fim de semana) vs ${fmt0(wkdayAvg)}€/dia (semana)`,
          explanation: 'Padrão detetado nos últimos 3 meses',
          priority: 60,
          color: 'info',
          meta: { action: 'openHistory' },
        });
      }
    }
  }

  // ── 8. Recurring micro-transactions ───────────────────────────────────────
  for (const { cat, spent } of catTotals) {
    if (spent < 10) continue;
    const txns = transactions.filter(
      t => t.type === 'expense' && t.category === cat.label && t.date && isInFinancialMonth(t.date, selectedMonth, startDay)
    );
    if (txns.length >= 5) {
      const avg = spent / txns.length;
      if (avg < 15) {
        items.push({
          type: 'pattern',
          title: `${txns.length} pequenas compras em ${cat.label}`,
          message: `Média de ${avg.toFixed(1)}€ cada — total acumulado: ${fmt0(spent)}€`,
          explanation: 'Pequenos gastos frequentes somam mais do que parece',
          priority: 50,
          color: 'info',
          meta: { action: 'openBudget', categoryLabel: cat.label },
        });
      }
    }
  }

  const ranked = applyFocusBoost(items, focus)
    .sort((a, b) => b.priority - a.priority);

  return ranked.slice(0, 4);
};

// ── Financial score (0-100) ─────────────────────────────────────────────────
export const computeFinancialScore = ({ transactions, budgets, categories, selectedMonth, startDay = 1 }) => {
  const prevMonth  = shiftMonth(selectedMonth, -1);
  const prev2Month = shiftMonth(selectedMonth, -2);

  const catSpent = (label, month) =>
    transactions
      .filter(t => t.type === 'expense' && t.category === label && t.date && isInFinancialMonth(t.date, month, startDay))
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  const catTotals = categories.expense.map(cat => ({
    cat,
    spent: catSpent(cat.label, selectedMonth),
  }));
  const totalCurr  = catTotals.reduce((s, c) => s + c.spent, 0);
  const totalPrev  = categories.expense.reduce((s, c) => s + catSpent(c.label, prevMonth),  0);
  const totalPrev2 = categories.expense.reduce((s, c) => s + catSpent(c.label, prev2Month), 0);

  // 1. Budget control (40 pts)
  const withBudget = catTotals.filter(c => (budgets[c.cat.id] || 0) > 0);
  let budgetPts = 20; // neutral when no budgets are set
  if (withBudget.length > 0) {
    const earned = withBudget.reduce((s, c) => {
      const pct = c.spent / budgets[c.cat.id];
      return s + (pct <= 0.8 ? 1 : pct <= 1.0 ? 0.4 : 0);
    }, 0);
    budgetPts = Math.round((earned / withBudget.length) * 40);
  }

  // 2. Monthly trend (30 pts)
  let trendPts = 20;
  if (totalPrev > 5) {
    const chg = (totalCurr - totalPrev) / totalPrev;
    trendPts = chg < -0.05 ? 30 : chg <= 0.05 ? 20 : chg <= 0.20 ? 10 : 0;
  }

  // 3. Stability (20 pts) — variance over last 3 months
  let stabilityPts = 10;
  if (totalPrev > 5 && totalPrev2 > 5) {
    const vals = [totalPrev2, totalPrev, totalCurr];
    const mean   = vals.reduce((s, v) => s + v, 0) / 3;
    const maxDev = Math.max(...vals.map(v => Math.abs(v - mean) / mean));
    stabilityPts = maxDev <= 0.15 ? 20 : maxDev <= 0.35 ? 12 : 5;
  }

  // 4. Category concentration (10 pts)
  let concPts = 10;
  if (totalCurr > 20) {
    const topShare = Math.max(...catTotals.map(c => c.spent)) / totalCurr;
    concPts = topShare <= 0.30 ? 10 : topShare <= 0.50 ? 5 : 0;
  }

  const score = Math.min(100, Math.round(budgetPts + trendPts + stabilityPts + concPts));
  const color = score >= 80 ? '#4ade80' : score >= 60 ? '#facc15' : score >= 40 ? '#fb923c' : '#f87171';
  const label = score >= 80 ? 'Excelente controlo financeiro'
              : score >= 60 ? 'Bom controlo — há margem para melhorar'
              : score >= 40 ? 'Atenção a alguns gastos'
              : 'Gastos sob pressão — ação necessária';

  return { score, color, label };
};

