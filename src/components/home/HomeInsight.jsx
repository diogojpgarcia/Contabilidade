import React, { useMemo } from 'react';
import { getFocusLine } from '../../utils/financialFocus';

function computeInsight(transactions) {
  const expenses = (transactions || []).filter(t => t.type === 'expense');

  if (expenses.length === 0) {
    return {
      icon: '💡',
      title: 'Sem despesas este mês',
      desc: 'Ainda não há gastos registados para este período.',
      badge: null,
    };
  }

  const totalExp = expenses.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  // Build per-category totals
  const byCategory = {};
  expenses.forEach(t => {
    const cat = t.category || 'Outro';
    byCategory[cat] = (byCategory[cat] || 0) + (parseFloat(t.amount) || 0);
  });
  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const [topCat, topAmt] = sorted[0];
  const pct = totalExp > 0 ? Math.round((topAmt / totalExp) * 100) : 0;

  if (pct >= 50) {
    return {
      icon: '⚠️',
      title: `${topCat} representa ${pct}% das despesas`,
      desc: `Gastaste ${topAmt.toFixed(0)}€ em ${topCat.toLowerCase()} — mais de metade do total este mês.`,
      badge: `${topAmt.toFixed(0)}€ de ${totalExp.toFixed(0)}€`,
      badgeType: 'warn',
      categoryLabel: topCat,
    };
  }

  return {
    icon: '💡',
    title: `Top gasto: ${topCat}`,
    desc: `${topCat} é a categoria com mais despesa este mês (${pct}% do total de ${totalExp.toFixed(0)}€).`,
    badge: `${topAmt.toFixed(0)}€`,
    badgeType: 'info',
    categoryLabel: topCat,
  };
}

const HomeInsight = ({ transactions, onNavigate, financialFocus = null }) => {
  const insight = useMemo(() => computeInsight(transactions), [transactions]);
  const focusLine = useMemo(() => getFocusLine(financialFocus, insight), [financialFocus, insight]);

  const tappable = !!(insight.categoryLabel && onNavigate);
  const handleTap = tappable
    ? () => onNavigate('budget', { categoryLabel: insight.categoryLabel })
    : undefined;

  return (
    <div className="h-card">
      <div className="h-section-title">Destaque</div>
      <div
        className={`h-insight${tappable ? ' h-insight--tappable' : ''}`}
        onClick={handleTap}
        role={tappable ? 'button' : undefined}
        tabIndex={tappable ? 0 : undefined}
        onKeyDown={tappable ? (e => e.key === 'Enter' && handleTap()) : undefined}
      >
        <span className="h-insight-icon">{insight.icon}</span>
        <div className="h-insight-body">
          <div className="h-insight-title">{insight.title}</div>
          <div className="h-insight-desc">{insight.desc}</div>
          {insight.badge && (
            <span className={`h-insight-badge ${insight.badgeType}`}>{insight.badge}</span>
          )}
        </div>
        {tappable && <span className="h-insight-chev">›</span>}
      </div>
      {focusLine && (
        <div className="h-focus-line">{focusLine}</div>
      )}
    </div>
  );
};

export default HomeInsight;
