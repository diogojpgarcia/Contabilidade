/**
 * StatsOverview.jsx — "Visão Geral" panel of StatsTab.
 * All typography via CSS classes (so-*) defined in fintech.css.
 */
import React, { useState } from 'react';
import BarChart from '../charts/BarChart';

const CAT_COLORS = ['var(--cosmos-accent)', 'var(--cosmos-income)', 'var(--cosmos-warning)', 'var(--cosmos-expense)', '#8B5CF6'];

const INSIGHT_CONFIG = {
  risk: {
    color: 'var(--cosmos-expense)',
    bg:    'var(--cosmos-expense-dim)',
    glow:  'rgba(248,113,113,0.18)',
    emoji: '⚠️',
  },
  warn: {
    color: 'var(--cosmos-warning, #f59e0b)',
    bg:    'var(--cosmos-warning-dim, rgba(245,158,11,0.12))',
    glow:  'rgba(245,158,11,0.16)',
    emoji: '⚡',
  },
  good: {
    color: 'var(--cosmos-income)',
    bg:    'var(--cosmos-income-dim)',
    glow:  'rgba(52,211,153,0.16)',
    emoji: '✦',
  },
  info: {
    color: 'var(--cosmos-accent)',
    bg:    'var(--cosmos-accent-soft)',
    glow:  'rgba(6,182,212,0.14)',
    emoji: '💡',
  },
};

const INITIAL_SHOW = 3;

const StatsOverview = ({
  monthSaldo, monthIncome, monthExpenses,
  saldoDelta, saldoDeltaLabel,
  monthlyData,
  categoryData,
  selectedCategories, setSelectedCategories,
  getCategoryMonthlyData,
  insights, financialScore,
  fmt,
  onShowLog,
}) => {
  const [showAll, setShowAll] = useState(false);
  const pct      = monthIncome > 0 ? Math.min((monthExpenses / monthIncome) * 100, 100) : 0;
  const barColor = pct >= 90 ? 'var(--cosmos-expense)' : pct >= 70 ? 'var(--cosmos-warning, #f59e0b)' : 'var(--cosmos-accent)';

  return (
    <div className="so-wrap">

      {/* ── 1. MAIN CARD ── */}
      <div className="so-card">
        <div className="so-card-top">
          <div className="so-saldo-label">Saldo do Mês</div>
          <div className="so-saldo-amount" style={{ color: monthSaldo >= 0 ? 'var(--cosmos-income)' : 'var(--cosmos-expense)' }}>
            {monthSaldo >= 0 ? '+' : '−'}{fmt(Math.abs(monthSaldo))}
          </div>
          <div className="so-saldo-delta" style={{ color: saldoDelta >= 0 ? 'var(--cosmos-income)' : 'var(--cosmos-expense)' }}>
            {saldoDeltaLabel}
          </div>
          <div className="so-divider" />
          {/* Income / ratio / Expenses */}
          <div className="so-cashflow-row">
            <div>
              <div className="so-cf-label">Receitas</div>
              <div className="so-cf-value" style={{ color: 'var(--cosmos-income)' }}>+{fmt(monthIncome)}</div>
            </div>
            <div className="so-ratio-bar">
              <div className="so-ratio-row">
                <span className="so-cf-label">Gasto</span>
                <span className="so-ratio-pct" style={{ color: barColor }}>{pct.toFixed(0)}%</span>
              </div>
              <div className="so-ratio-track">
                <div className="so-ratio-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, var(--cosmos-accent), ${barColor})` }} />
              </div>
            </div>
            <div className="so-cashflow-right">
              <div className="so-cf-label">Despesas</div>
              <div className="so-cf-value" style={{ color: 'var(--cosmos-expense)' }}>−{fmt(monthExpenses)}</div>
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <div className="so-chart-wrap">
          <BarChart data={monthlyData} height={100} />
        </div>
      </div>

      {/* ── 2. TOP CATEGORIES ── */}
      {categoryData.length > 0 && (
        <div className="so-cats-wrap">
          <div className="so-section-label">Top Categorias</div>
          {categoryData.slice(0, 5).map((cat, i) => {
            const isSelected = selectedCategories.includes(cat.category);
            const color      = CAT_COLORS[i % 5];
            return (
              <div
                key={cat.category}
                className="so-cat-row"
                onClick={() => setSelectedCategories(prev =>
                  prev.includes(cat.category)
                    ? prev.filter(c => c !== cat.category)
                    : [...prev, cat.category]
                )}
              >
                <div
                  className="so-cat-dot"
                  style={{
                    background: color,
                    transform:  isSelected ? 'scale(1.5)' : 'scale(1)',
                    boxShadow:  isSelected ? `0 0 8px ${color}` : 'none',
                  }}
                />
                <div
                  className="so-cat-name"
                  style={{
                    color:      isSelected ? 'var(--cosmos-text-1)' : 'var(--cosmos-text-2)',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {cat.category}
                </div>
                <div className="so-cat-bar-wrap">
                  <div className="so-cat-pct" style={{ color }}>{cat.percentage.toFixed(0)}%</div>
                  <div className="so-cat-track">
                    <div className="so-cat-fill" style={{ width: `${cat.percentage}%`, background: color, opacity: isSelected ? 1 : 0.7 }} />
                  </div>
                </div>
                <div className="so-cat-amount">{fmt(cat.amount)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 3. SCORE + INSIGHTS ── */}
      <div className="so-score-card">
        {/* Score ring */}
        <div className="so-score-row">
          <div
            className="so-score-ring"
            style={{ background: `conic-gradient(${financialScore.color} 0% ${financialScore.score}%, var(--cosmos-border-divider) ${financialScore.score}% 100%)` }}
          >
            <div className="so-score-inner" style={{ color: financialScore.color }}>
              {financialScore.score}
            </div>
          </div>
          <div>
            <div className="so-cf-label">Score Financeiro</div>
            <div className="so-score-label">{financialScore.label}</div>
          </div>
        </div>

        {insights.length > 0 && <div className="so-divider" style={{ margin: '14px 0 12px' }} />}

        {/* Insights */}
        {insights.length > 0 && (
          <div className="so-insights-list">
            {(showAll ? insights : insights.slice(0, INITIAL_SHOW)).map((item, i) => {
              const cfg = INSIGHT_CONFIG[item.color] || INSIGHT_CONFIG.info;
              return (
                <div
                  key={i}
                  className={`so-insight${item.meta ? ' so-insight--tap' : ''}`}
                  style={{
                    '--si-color': cfg.color,
                    '--si-bg':    cfg.bg,
                    '--si-glow':  cfg.glow,
                  }}
                  onClick={() => item.meta?.action === 'openHistory' && onShowLog?.()}
                >
                  <div className="so-insight-badge">{cfg.emoji}</div>
                  <div className="so-insight-body">
                    <div className="so-insight-title">{item.title}</div>
                    <div className="so-insight-msg">{item.message}</div>
                    {item.explanation && <div className="so-insight-exp">{item.explanation}</div>}
                  </div>
                  {item.meta && <span className="so-insight-chev">›</span>}
                </div>
              );
            })}

            {insights.length > INITIAL_SHOW && (
              <button className="so-insight-more-btn" onClick={() => setShowAll(v => !v)}>
                {showAll
                  ? '↑ Mostrar menos'
                  : `Ver mais ${insights.length - INITIAL_SHOW} insight${insights.length - INITIAL_SHOW > 1 ? 's' : ''} →`}
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

export default StatsOverview;
