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

const fmt0 = (n) => n.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const generateInsights = ({ transactions, budgets, categories, selectedMonth }) => {
  const prevMonth = shiftMonth(selectedMonth, -1);
  const items = [];

  // Days remaining in selected month (0 if past month)
  const today = new Date();
  const [sy, sm] = selectedMonth.split('-').map(Number);
  const isCurrentMonth = today.getFullYear() === sy && today.getMonth() + 1 === sm;
  const daysInMonth = new Date(sy, sm, 0).getDate();
  const daysLeft = isCurrentMonth ? daysInMonth - today.getDate() : 0;

  // Category totals for current + previous month
  const catTotals = categories.expense.map(cat => ({
    cat,
    spent:     getSpent(transactions, cat.label, selectedMonth),
    prevSpent: getSpent(transactions, cat.label, prevMonth),
  }));

  const totalCurr = catTotals.reduce((s, c) => s + c.spent, 0);
  const totalPrev = catTotals.reduce((s, c) => s + c.prevSpent, 0);

  // Category with biggest absolute increase vs last month (for trend extra)
  const biggestIncrease = catTotals
    .filter(c => c.spent > c.prevSpent)
    .sort((a, b) => (b.spent - b.prevSpent) - (a.spent - a.prevSpent))[0];
  const biggestDecrease = catTotals
    .filter(c => c.prevSpent > c.spent && c.prevSpent > 5)
    .sort((a, b) => (b.prevSpent - b.spent) - (a.prevSpent - a.spent))[0];

  // Top spent category
  const topCat = catTotals.filter(c => c.spent > 0).sort((a, b) => b.spent - a.spent)[0];

  for (const { cat, spent, prevSpent } of catTotals) {
    const limit   = budgets[cat.id] || 0;
    const percent = limit > 0 ? (spent / limit) * 100 : 0;

    if (limit > 0 && percent >= 100) {
      const over = spent - limit;
      items.push({
        type: 'budget_exceeded',
        title: `Limite ultrapassado em ${cat.label}`,
        message: `${fmt0(spent)}€ de ${fmt0(limit)}€ — ${fmt0(over)}€ acima`,
        value: `${percent.toFixed(0)}%`,
        extra: daysLeft > 0 ? `Ainda faltam ${daysLeft} dias para o fim do mês` : 'Mês encerrado',
        action: 'Evita novos gastos nesta categoria este mês',
        priority: 100,
        color: 'risk',
      });
    } else if (limit > 0 && percent >= 80) {
      const remaining = limit - spent;
      items.push({
        type: 'budget_warning',
        title: `Estás perto do limite em ${cat.label}`,
        message: `${fmt0(spent)}€ de ${fmt0(limit)}€ já usados`,
        value: `${percent.toFixed(0)}%`,
        extra: daysLeft > 0
          ? `Faltam ${fmt0(remaining)}€ e ${daysLeft} dias para o fim do mês`
          : `Faltam ${fmt0(remaining)}€ para o limite`,
        action: 'Reduz gastos nesta categoria para evitar ultrapassar',
        priority: 100,
        color: 'warn',
      });
    }

    const predicted = getPrediction(spent, selectedMonth);
    if (predicted !== null && limit > 0 && predicted > limit && percent < 100) {
      items.push({
        type: 'prediction',
        title: `Risco de ultrapassar ${cat.label}`,
        message: `Ao ritmo atual vais gastar ${fmt0(predicted)}€ (limite: ${fmt0(limit)}€)`,
        value: `${fmt0(predicted)}€`,
        extra: `Já usaste ${percent.toFixed(0)}% do orçamento`,
        action: 'Abranda os gastos até ao fim do mês',
        priority: 90,
        color: 'risk',
      });
    }

    if (prevSpent > 5 && spent > prevSpent) {
      const pct = ((spent - prevSpent) / prevSpent) * 100;
      if (pct >= 20) {
        items.push({
          type: 'category_increase',
          title: `${cat.label} aumentou significativamente`,
          message: `${fmt0(prevSpent)}€ → ${fmt0(spent)}€ vs mês anterior`,
          value: `+${pct.toFixed(0)}%`,
          extra: `Aumento de ${fmt0(spent - prevSpent)}€ face ao mês passado`,
          action: 'Verifica se há gastos inesperados nesta categoria',
          priority: 80,
          color: 'warn',
        });
      }
    }
  }

  if (topCat && topCat.spent > 0) {
    const share = totalCurr > 0 ? (topCat.spent / totalCurr) * 100 : 0;
    items.push({
      type: 'top_category',
      title: 'Maior foco de gasto',
      message: `${topCat.cat.label} representa ${share.toFixed(0)}% do total`,
      value: `${fmt0(topCat.spent)}€`,
      extra: `Total gasto este mês: ${fmt0(totalCurr)}€`,
      action: 'Rever esta categoria pode gerar poupança',
      priority: 70,
      color: 'info',
    });
  }

  if (totalPrev > 5) {
    const trendPct = ((totalCurr - totalPrev) / totalPrev) * 100;
    const diff = totalCurr - totalPrev;
    const trendUp = diff > 0;
    const contextCat = trendUp ? biggestIncrease : biggestDecrease;
    items.push({
      type: 'trend',
      title: trendUp ? 'Estás a gastar mais este mês' : 'Estás a gastar menos este mês',
      message: `${trendUp ? '+' : ''}${fmt0(diff)}€ vs mês anterior`,
      value: `${trendUp ? '+' : ''}${trendPct.toFixed(0)}%`,
      extra: contextCat
        ? trendUp
          ? `Principal aumento em ${contextCat.cat.label}`
          : `Principal poupança em ${contextCat.cat.label}`
        : null,
      action: trendUp
        ? 'Identifica onde estás a gastar mais e toma ação'
        : 'Bom controlo — mantém este ritmo',
      priority: 60,
      color: trendPct > 10 ? 'warn' : trendPct < 0 ? 'good' : 'info',
    });
  }

  return items
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);
};
