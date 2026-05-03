const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export const shiftMonth = (yyyymm, delta) => {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const formatMonthLabel = (yyyymm) => {
  const [y, m] = yyyymm.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

export const getPrediction = (spent, selectedMonth) => {
  const today = new Date();
  const [y, m] = selectedMonth.split('-').map(Number);
  if (today.getFullYear() !== y || today.getMonth() + 1 !== m) return null;
  const daysPassed = today.getDate();
  if (daysPassed === 0 || spent === 0) return null;
  const daysTotal = new Date(y, m, 0).getDate();
  return Math.round((spent / daysPassed) * daysTotal);
};

const getSpent = (transactions, catName, month) =>
  transactions
    .filter(t => t.type === 'expense' && t.category === catName && t.date && t.date.startsWith(month))
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

const fmt0 = (n) =>
  Math.abs(n).toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const generateInsights = ({ transactions, budgets, categories, selectedMonth }) => {
  const items = [];

  const prevMonth  = shiftMonth(selectedMonth, -1);
  const prev2Month = shiftMonth(selectedMonth, -2);
  const prev3Month = shiftMonth(selectedMonth, -3);
  const prev4Month = shiftMonth(selectedMonth, -4);
  const prev5Month = shiftMonth(selectedMonth, -5);

  // Current month timing
  const today = new Date();
  const [sy, sm] = selectedMonth.split('-').map(Number);
  const isCurrentMonth = today.getFullYear() === sy && today.getMonth() + 1 === sm;
  const daysInMonth  = new Date(sy, sm, 0).getDate();
  const daysPassed   = isCurrentMonth ? today.getDate() : daysInMonth;
  const daysLeft     = isCurrentMonth ? daysInMonth - daysPassed : 0;

  // Per-category current + previous month totals
  const catTotals = categories.expense.map(cat => ({
    cat,
    spent:     getSpent(transactions, cat.label, selectedMonth),
    prevSpent: getSpent(transactions, cat.label, prevMonth),
  }));
  const totalCurr = catTotals.reduce((s, c) => s + c.spent, 0);

  // ── 1. Budget alerts ───────────────────────────────────────────────────────
  for (const { cat, spent } of catTotals) {
    const limit   = budgets[cat.id] || 0;
    const percent = limit > 0 ? (spent / limit) * 100 : 0;

    if (limit > 0 && percent >= 100) {
      items.push({
        type: 'alert',
        title: `Limite ultrapassado em ${cat.label}`,
        message: `${fmt0(spent)}€ de ${fmt0(limit)}€ usados`,
        explanation: `Excedeste em ${fmt0(spent - limit)}€${daysLeft > 0 ? ` — ainda faltam ${daysLeft} dias` : ''}`,
        priority: 100,
        color: 'risk',
      });
    } else if (limit > 0 && percent >= 80) {
      items.push({
        type: 'risk',
        title: `Estás perto do limite em ${cat.label}`,
        message: `${fmt0(spent)}€ de ${fmt0(limit)}€ usados (${percent.toFixed(0)}%)`,
        explanation: daysLeft > 0
          ? `Faltam ${fmt0(limit - spent)}€ para o limite e ainda ${daysLeft} dias no mês`
          : `Faltam ${fmt0(limit - spent)}€ para o limite`,
        priority: 90,
        color: 'warn',
      });
    }

    // Projection: current pace → end of month
    if (isCurrentMonth && limit > 0 && daysPassed > 3 && percent < 100) {
      const projected = Math.round((spent / daysPassed) * daysInMonth);
      if (projected > limit) {
        items.push({
          type: 'alert',
          title: `Projeção: vais ultrapassar ${cat.label}`,
          message: `Ao ritmo atual: ${fmt0(projected)}€ previsto (limite: ${fmt0(limit)}€)`,
          explanation: `Já usaste ${percent.toFixed(0)}% em ${daysPassed} dias — reduz o ritmo`,
          priority: 85,
          color: 'risk',
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
          title: 'Concentração elevada de despesas',
          message: `${topCat.cat.label} representa ${share.toFixed(0)}% do total`,
          explanation: `${fmt0(topCat.spent)}€ de ${fmt0(totalCurr)}€ totais — rever pode gerar poupança`,
          priority: 80,
          color: share >= 70 ? 'risk' : 'warn',
        });
      }
    }
  }

  // ── 3. 3-month consecutive increase in a category ─────────────────────────
  for (const { cat } of catTotals) {
    const [m0, m1, m2] = [prev2Month, prevMonth, selectedMonth]
      .map(m => getSpent(transactions, cat.label, m));
    // Require non-trivial base and 10%+ increase each step
    if (m0 > 10 && m1 > m0 * 1.1 && m2 > m1 * 1.1) {
      const growth = ((m2 - m0) / m0 * 100).toFixed(0);
      items.push({
        type: 'trend',
        title: `${cat.label} cresce há 3 meses seguidos`,
        message: `${fmt0(m0)}€ → ${fmt0(m1)}€ → ${fmt0(m2)}€`,
        explanation: `+${growth}% em 3 meses — tendência de aumento consistente`,
        priority: 75,
        color: 'warn',
      });
    }
  }

  // ── 4. Spending volatility ─────────────────────────────────────────────────
  // Coefficient of variation > 0.7 across 6 months signals unpredictability
  for (const { cat } of catTotals) {
    const monthly = [prev5Month, prev4Month, prev3Month, prev2Month, prevMonth, selectedMonth]
      .map(m => getSpent(transactions, cat.label, m))
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
          title: `Gastos irregulares em ${cat.label}`,
          message: `Variação de ${min}€ a ${max}€ nos últimos meses`,
          explanation: `Padrão imprevisível dificulta planeamento — considera definir um orçamento fixo`,
          priority: 65,
          color: 'info',
        });
      }
    }
  }

  // ── 5. Weekend vs weekday spending pattern ─────────────────────────────────
  // Look at last 3 months of expenses
  const windowStart = prev2Month + '-01';
  const recentExpenses = transactions.filter(
    t => t.type === 'expense' && t.date && t.date >= windowStart
  );
  if (recentExpenses.length >= 10) {
    let weekendTotal = 0; const weekendDays = new Set();
    let weekdayTotal = 0; const weekdayDays = new Set();
    for (const t of recentExpenses) {
      const dow    = new Date(t.date + 'T12:00:00').getDay(); // midday avoids DST issues
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
          title: 'Gastas mais ao fim de semana',
          message: `Média: ${fmt0(wkendAvg)}€/dia (fim de semana) vs ${fmt0(wkdayAvg)}€/dia (semana)`,
          explanation: `${ratio}× mais por dia — padrão detetado nos últimos 3 meses`,
          priority: 60,
          color: 'info',
        });
      }
    }
  }

  // ── 6. Recurring micro-transactions ───────────────────────────────────────
  // 5+ transactions in a category averaging < €15 this month
  for (const { cat, spent } of catTotals) {
    if (spent < 10) continue;
    const txns = transactions.filter(
      t => t.type === 'expense' && t.category === cat.label && t.date && t.date.startsWith(selectedMonth)
    );
    if (txns.length >= 5) {
      const avg = spent / txns.length;
      if (avg < 15) {
        items.push({
          type: 'pattern',
          title: `Micropagamentos frequentes em ${cat.label}`,
          message: `${txns.length} transações com média de ${avg.toFixed(1)}€`,
          explanation: `Total acumulado: ${fmt0(spent)}€ — pequenos gastos regulares somam`,
          priority: 50,
          color: 'info',
        });
      }
    }
  }

  return items
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 4);
};

// ── Financial score (0-100) ─────────────────────────────────────────────────
export const computeFinancialScore = ({ transactions, budgets, categories, selectedMonth }) => {
  const prevMonth  = shiftMonth(selectedMonth, -1);
  const prev2Month = shiftMonth(selectedMonth, -2);

  const catSpent = (label, month) =>
    transactions
      .filter(t => t.type === 'expense' && t.category === label && t.date && t.date.startsWith(month))
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
