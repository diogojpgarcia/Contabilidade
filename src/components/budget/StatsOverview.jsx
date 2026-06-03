/**
 * StatsOverview.jsx
 * The "Visão Geral" panel of StatsTab — extracted from the inline IIFE.
 * Renders: main balance card + sparkline chart + top categories + financial score + insights.
 */
import React from 'react';

const CAT_COLORS = ['var(--cosmos-accent)', 'var(--cosmos-income)', 'var(--cosmos-warning)', 'var(--cosmos-expense)', '#8B5CF6'];

const INSIGHT_CONFIG = {
  risk: { color: 'var(--cosmos-expense)', bg: 'rgba(248,113,113,0.08)', emoji: '⚠️' },
  warn: { color: 'var(--cosmos-warning)', bg: 'rgba(251,146,60,0.08)',  emoji: '⚡' },
  good: { color: 'var(--cosmos-income)', bg: 'rgba(34,197,94,0.08)',   emoji: '📈' },
  info: { color: 'var(--cosmos-text-3)', bg: 'rgba(148,163,184,0.06)', emoji: '💡' },
};

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
  const pct      = monthIncome > 0 ? Math.min((monthExpenses / monthIncome) * 100, 100) : 0;
  const barColor = pct >= 90 ? 'var(--cosmos-expense)' : pct >= 70 ? 'var(--cosmos-warning)' : 'var(--cosmos-accent)';
  const maxValG  = Math.max(...(monthlyData || []).map(m => Math.max(m.income, m.expenses)), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── 1. CARD PRINCIPAL ── */}
      <div style={{
        borderRadius: '20px',
        background: 'var(--cosmos-surface-1)',
        border: '1px solid var(--cosmos-border-divider)',
        margin: '0 16px',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}>
        {/* Top section */}
        <div style={{ padding: '20px 20px 12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--cosmos-text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
            Saldo do Mês
          </div>
          <div style={{ fontSize: '36px', fontWeight: 700, color: monthSaldo >= 0 ? 'var(--cosmos-income)' : 'var(--cosmos-expense)', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: '6px' }}>
            {monthSaldo >= 0 ? '+' : '−'}{fmt(Math.abs(monthSaldo))}
          </div>
          <div style={{ fontSize: '13px', color: saldoDelta >= 0 ? 'var(--cosmos-income)' : 'var(--cosmos-expense)', marginBottom: '14px' }}>
            {saldoDeltaLabel}
          </div>
          <div style={{ height: '1px', background: 'var(--cosmos-border-subtle)', marginBottom: '14px' }} />
          {/* Income / ratio bar / Expenses */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--cosmos-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Receitas</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--cosmos-income)' }}>+{fmt(monthIncome)}</div>
            </div>
            <div style={{ flex: 1, maxWidth: '120px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--cosmos-text-3)', marginBottom: '4px' }}>
                <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Gasto</span>
                <span style={{ color: barColor, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
              </div>
              <div style={{ height: '3px', background: 'var(--cosmos-border-divider)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, var(--cosmos-accent), ${barColor})`, borderRadius: '3px', transition: 'width 0.4s ease' }} />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: 'var(--cosmos-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Despesas</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--cosmos-expense)' }}>−{fmt(monthExpenses)}</div>
            </div>
          </div>
        </div>

        {/* Category filter labels */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px', height: '32px', flexWrap: 'nowrap', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: '6px', flex: 1, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', touchAction: 'pan-x', opacity: selectedCategories.length > 0 ? 1 : 0, transition: 'opacity 0.15s ease', paddingBottom: '2px' }}>
              {selectedCategories.map(cat => {
                const idx   = categoryData.findIndex(c => c.category === cat);
                const color = CAT_COLORS[idx % 5] || 'var(--cosmos-accent)';
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: `${color}18`, borderRadius: '12px', padding: '2px 8px', flexShrink: 0 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: '11px', color: color, whiteSpace: 'nowrap' }}>{cat}</span>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setSelectedCategories([])} style={{ fontSize: '11px', color: 'var(--cosmos-text-3)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, paddingLeft: '8px', opacity: selectedCategories.length > 0 ? 1 : 0, pointerEvents: selectedCategories.length > 0 ? 'auto' : 'none', transition: 'opacity 0.15s ease' }}>
              Limpar ×
            </button>
          </div>

          {/* SVG chart — category-filtered or global */}
          {selectedCategories.length > 0 ? (() => {
            const maxCat = Math.max(...selectedCategories.flatMap(cat => getCategoryMonthlyData(cat).map(d => d.amount)), 1);
            return (
              <svg width="100%" height={72} viewBox="0 0 340 72" preserveAspectRatio="none" style={{ display: 'block' }}>
                <defs>
                  {selectedCategories.map((cat, ci) => {
                    const idx   = categoryData.findIndex(c => c.category === cat);
                    const color = CAT_COLORS[idx % 5] || 'var(--cosmos-accent)';
                    return <linearGradient key={cat} id={`catGrad${ci}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient>;
                  })}
                </defs>
                {selectedCategories.map((cat, ci) => {
                  const idx   = categoryData.findIndex(c => c.category === cat);
                  const color = CAT_COLORS[idx % 5] || 'var(--cosmos-accent)';
                  const pts   = getCategoryMonthlyData(cat).map((d, i) => ({ x: (i / 5) * 340, y: 68 - (d.amount / maxCat) * 60 }));
                  const area  = `M${pts[0].x},${pts[0].y} ` + pts.slice(1).map(p => `L${p.x},${p.y}`).join(' ') + ` L340,68 L0,68 Z`;
                  return (
                    <g key={cat}>
                      <path d={area} fill={`url(#catGrad${ci})`} />
                      <polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill={color} />
                    </g>
                  );
                })}
              </svg>
            );
          })() : (
            <svg width="100%" height={72} viewBox="0 0 340 72" preserveAspectRatio="none" style={{ display: 'block' }}>
              <defs>
                <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--cosmos-income)" stopOpacity="0.25" /><stop offset="100%" stopColor="var(--cosmos-income)" stopOpacity="0" /></linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--cosmos-expense)" stopOpacity="0.2" /><stop offset="100%" stopColor="var(--cosmos-expense)" stopOpacity="0" /></linearGradient>
              </defs>
              <path d={`M0,${68-(monthlyData[0].income/maxValG)*60} ` + monthlyData.map((d,i) => `L${(i/5)*340},${68-(d.income/maxValG)*60}`).join(' ') + ' L340,68 L0,68 Z'} fill="url(#incGrad)" />
              <path d={`M0,${68-(monthlyData[0].expenses/maxValG)*60} ` + monthlyData.map((d,i) => `L${(i/5)*340},${68-(d.expenses/maxValG)*60}`).join(' ') + ' L340,68 L0,68 Z'} fill="url(#expGrad)" />
              <polyline points={monthlyData.map((d,i) => `${(i/5)*340},${68-(d.income/maxValG)*60}`).join(' ')} fill="none" stroke="var(--cosmos-income)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={monthlyData.map((d,i) => `${(i/5)*340},${68-(d.expenses/maxValG)*60}`).join(' ')} fill="none" stroke="var(--cosmos-expense)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}

          {/* Month labels */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 16px 14px' }}>
            {monthlyData.map((d, i) => <span key={i} style={{ fontSize: '10px', color: 'var(--cosmos-text-3)' }}>{d.month}</span>)}
          </div>
        </div>
      </div>

      {/* ── 2. TOP CATEGORIAS ── */}
      {categoryData.length > 0 && (
        <div style={{ margin: '12px 16px 0' }}>
          <div style={{ fontSize: '11px', color: 'var(--cosmos-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Top Categorias</div>
          {categoryData.slice(0, 5).map((cat, i) => {
            const isSelected = selectedCategories.includes(cat.category);
            return (
              <div key={cat.category} onClick={() => setSelectedCategories(prev => prev.includes(cat.category) ? prev.filter(c => c !== cat.category) : [...prev, cat.category])} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', cursor: 'pointer' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: CAT_COLORS[i % 5], flexShrink: 0, transform: isSelected ? 'scale(1.5)' : 'scale(1)', boxShadow: isSelected ? `0 0 8px ${CAT_COLORS[i % 5]}` : 'none', transition: 'all 0.2s' }} />
                <div style={{ flex: 1, fontSize: '14px', color: isSelected ? 'var(--cosmos-text-1)' : 'var(--cosmos-text-2)', fontWeight: isSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.category}</div>
                <div style={{ width: '100px', flexShrink: 0 }}>
                  <div style={{ fontSize: '12px', color: CAT_COLORS[i % 5], textAlign: 'right', marginBottom: '3px' }}>{cat.percentage.toFixed(0)}%</div>
                  <div style={{ height: '3px', background: 'var(--cosmos-border-divider)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${cat.percentage}%`, background: CAT_COLORS[i % 5], borderRadius: '3px', opacity: isSelected ? 1 : 0.7 }} />
                  </div>
                </div>
                <div style={{ width: '64px', fontSize: '13px', color: 'var(--cosmos-text-3)', textAlign: 'right', flexShrink: 0 }}>{fmt(cat.amount)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 3. SCORE + INSIGHTS ── */}
      <div style={{ margin: '12px 16px 0', background: 'var(--cosmos-border-subtle)', border: '1px solid var(--cosmos-border-divider)', borderRadius: '16px', padding: '16px' }}>
        {/* Score ring */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: `conic-gradient(${financialScore.color} 0% ${financialScore.score}%, rgba(255,255,255,0.08) ${financialScore.score}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ width: '35px', height: '35px', borderRadius: '50%', background: 'var(--cosmos-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: financialScore.color }}>{financialScore.score}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--cosmos-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>Score Financeiro</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--cosmos-text-1)' }}>{financialScore.label}</div>
          </div>
        </div>
        {insights.length > 0 && <div style={{ height: '1px', background: 'var(--cosmos-border-subtle)', margin: '12px 0' }} />}
        {/* Insights */}
        {insights.slice(0, 3).map((item, i) => {
          const cfg = INSIGHT_CONFIG[item.color] || INSIGHT_CONFIG.info;
          return (
            <div key={i} onClick={() => item.meta?.action === 'openHistory' && onShowLog?.()} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px', borderRadius: '12px', background: cfg.bg, borderLeft: `3px solid ${cfg.color}`, marginBottom: i < 2 ? '8px' : 0, cursor: item.meta ? 'pointer' : 'default' }}>
              <span style={{ fontSize: '20px', lineHeight: 1, marginTop: '1px', flexShrink: 0 }}>{cfg.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--cosmos-text-1)', marginBottom: '3px' }}>{item.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--cosmos-text-3)', lineHeight: 1.5 }}>{item.message}</div>
                {item.explanation && <div style={{ fontSize: '11px', color: 'var(--cosmos-text-3)', marginTop: '4px', lineHeight: 1.4 }}>{item.explanation}</div>}
              </div>
              {item.meta && <span style={{ color: 'var(--cosmos-text-3)', fontSize: '16px', alignSelf: 'center' }}>›</span>}
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default StatsOverview;
