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
    .filter(t => t.type === 'expense' && t.category === catName && t.date.startsWith(month))
    .reduce((s, t) => s + parseFloat(t.amount), 0);

export const generateInsights = ({ transactions, budgets, categories, selectedMonth }) => {
  const prevMonth = shiftMonth(selectedMonth, -1);
  const items = [];
  let topSpent = 0;
  let topCatLabel = null;

  for (const cat of categories.expense) {
    const limit     = budgets[cat.id] || 0;
    const spent     = getSpent(transactions, cat.label, selectedMonth);
    const prevSpent = getSpent(transactions, cat.label, prevMonth);
    const percent   = limit > 0 ? (spent / limit) * 100 : 0;

    if (spent > topSpent) { topSpent = spent; topCatLabel = cat.label; }

    if (limit > 0 && percent >= 100) {
      items.push({
        type: 'budget_exceeded',
        title: cat.label,
        value: `${percent.toFixed(0)}%`,
        message: `Excedido em ${(spent - limit).toFixed(0)}€`,
        priority: 100,
        color: 'risk',
      });
    } else if (limit > 0 && percent >= 80) {
      items.push({
        type: 'budget_warning',
        title: cat.label,
        value: `${percent.toFixed(0)}%`,
        message: `${spent.toFixed(0)}€ de ${limit.toFixed(0)}€ usados`,
        priority: 100,
        color: 'warn',
      });
    }

    const predicted = getPrediction(spent, selectedMonth);
    if (predicted !== null && limit > 0 && predicted > limit && percent < 100) {
      items.push({
        type: 'prediction',
        title: cat.label,
        value: `${predicted}€`,
        message: `Previsão: ${((predicted / limit) * 100).toFixed(0)}% do orçamento`,
        priority: 90,
        color: 'risk',
      });
    }

    if (prevSpent > 5 && spent > prevSpent) {
      const pct = ((spent - prevSpent) / prevSpent) * 100;
      if (pct >= 20) {
        items.push({
          type: 'category_increase',
          title: cat.label,
          value: `+${pct.toFixed(0)}%`,
          message: `${prevSpent.toFixed(0)}€ → ${spent.toFixed(0)}€ vs mês anterior`,
          priority: 80,
          color: 'warn',
        });
      }
    }
  }

  if (topCatLabel && topSpent > 0) {
    items.push({
      type: 'top_category',
      title: topCatLabel,
      value: `${topSpent.toFixed(0)}€`,
      message: 'Categoria com maior despesa',
      priority: 70,
      color: 'info',
    });
  }

  const totalCurr = categories.expense.reduce((s, c) => s + getSpent(transactions, c.label, selectedMonth), 0);
  const totalPrev = categories.expense.reduce((s, c) => s + getSpent(transactions, c.label, prevMonth), 0);
  if (totalPrev > 5) {
    const trendPct = ((totalCurr - totalPrev) / totalPrev) * 100;
    items.push({
      type: 'trend',
      title: 'Tendência mensal',
      value: `${trendPct > 0 ? '+' : ''}${trendPct.toFixed(0)}%`,
      message: trendPct > 0
        ? `+${(totalCurr - totalPrev).toFixed(0)}€ vs mês anterior`
        : `−${Math.abs(totalCurr - totalPrev).toFixed(0)}€ vs mês anterior`,
      priority: 60,
      color: trendPct > 10 ? 'warn' : trendPct < 0 ? 'good' : 'info',
    });
  }

  return items
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
};
