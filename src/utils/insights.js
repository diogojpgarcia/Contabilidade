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

// ── Smart Goals (auto-generated, max 3) ─────────────────────────────────────
export const generateGoals = ({ transactions, budgets, categories, selectedMonth }) => {
  const prevMonth = shiftMonth(selectedMonth, -1);

  const monthSpend = (catLabel, month) =>
    transactions
      .filter(t => t.type === 'expense' && t.category === catLabel && t.date && t.date.startsWith(month))
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  const catTotals = categories.expense.map(cat => ({
    cat,
    current: monthSpend(cat.label, selectedMonth),
    prev:    monthSpend(cat.label, prevMonth),
  }));

  const totalCurrent = catTotals.reduce((s, c) => s + c.current, 0);
  const totalPrev    = catTotals.reduce((s, c) => s + c.prev, 0);
  const monthIncome  = transactions
    .filter(t => t.type === 'income' && t.date && t.date.startsWith(selectedMonth))
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  const goal = (type, title, description, targetAmount, currentAmount) => {
    // progress = "remaining room" for spending goals, "fill" for saving goals
    const isSaving = type === 'saving';
    const rawPct   = isSaving
      ? Math.min(100, Math.round((currentAmount / targetAmount) * 100))
      : Math.max(0,   Math.round((1 - currentAmount / targetAmount) * 100));
    const progressPct = Math.max(0, rawPct);
    const status = isSaving
      ? (progressPct >= 100 ? 'done' : progressPct >= 50 ? 'on_track' : 'behind')
      : (currentAmount <= targetAmount * 0.8 ? 'on_track' : currentAmount <= targetAmount ? 'risk' : 'behind');
    const barColor = status === 'done' || status === 'on_track' ? '#4ade80'
                   : status === 'risk' ? '#facc15' : '#f87171';
    return { type, title, description, targetAmount, currentAmount, progressPct, status, barColor };
  };

  const goals = [];

  // 1. Reduction: biggest category that grew vs last month
  const biggestRiser = catTotals
    .filter(c => c.prev > 10 && c.current > c.prev * 1.15)
    .sort((a, b) => (b.current - b.prev) - (a.current - a.prev))[0];
  if (biggestRiser) {
    const target = Math.round(biggestRiser.prev * 1.05); // allow 5% above last month
    goals.push(goal(
      'reduction',
      `Reduzir ${biggestRiser.cat.label}`,
      `Gastar ≤ ${fmt0(target)}€ (mês passado: ${fmt0(biggestRiser.prev)}€)`,
      target, biggestRiser.current,
    ));
  }

  // 2. Saving: 10% of this month's income
  if (monthIncome >= 50) {
    const target  = Math.round(monthIncome * 0.10);
    const savings = Math.max(0, monthIncome - totalCurrent);
    goals.push(goal(
      'saving',
      'Poupar este mês',
      `Meta: ${fmt0(target)}€ (10% de ${fmt0(monthIncome)}€)`,
      target, savings,
    ));
  }

  // 3. Balance: reduce concentration if top category > 50%
  if (totalCurrent > 20 && goals.length < 3) {
    const topCat = catTotals.filter(c => c.current > 0).sort((a, b) => b.current - a.current)[0];
    if (topCat && topCat.current / totalCurrent > 0.5) {
      const target = Math.round(totalCurrent * 0.40);
      goals.push(goal(
        'balance',
        `Equilibrar ${topCat.cat.label}`,
        `Reduzir para ≤ ${fmt0(target)}€ (40% do total de ${fmt0(totalCurrent)}€)`,
        target, topCat.current,
      ));
    }
  }

  // 4. Improvement: overall spending 5% below last month (filler if < 2 goals)
  if (totalPrev > 10 && goals.length < 2) {
    const target = Math.round(totalPrev * 0.95);
    goals.push(goal(
      'improvement',
      'Melhorar vs mês passado',
      `Total de despesas ≤ ${fmt0(target)}€ (−5% vs ${fmt0(totalPrev)}€)`,
      target, totalCurrent,
    ));
  }

  return goals.slice(0, 3);
};
