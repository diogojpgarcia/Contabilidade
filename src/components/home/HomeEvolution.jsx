import React from 'react';

function fmt(val) {
  return (parseFloat(val) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const HomeEvolution = ({ patrimonyTotal, income, balance, investments = 0, realestate = 0 }) => {
  const savingsRate   = income > 0 ? Math.round((balance / income) * 100) : null;
  const ratePositive  = savingsRate !== null && savingsRate >= 0;

  const cells = [
    { label: 'Saldo total',    value: fmt(patrimonyTotal) + '€', cls: '' },
    savingsRate !== null
      ? { label: 'Taxa poupança', value: savingsRate + '%', cls: ratePositive ? 'positive' : 'negative', sub: 'deste período' }
      : null,
    investments > 0
      ? { label: 'Investimentos', value: fmt(investments) + '€', cls: '' }
      : null,
    realestate > 0
      ? { label: 'Imóveis',       value: fmt(realestate) + '€',  cls: '' }
      : null,
  ].filter(Boolean);

  return (
    <div className="h-card">
      <div className="h-section-title">Visão geral</div>

      {savingsRate !== null && (
        <div className="h-savings-bar-track" style={{ marginBottom: 14 }}>
          <div
            className="h-savings-bar-fill"
            style={{
              width: `${Math.min(100, Math.max(0, savingsRate))}%`,
              background: ratePositive ? '#10b981' : '#ef4444',
            }}
          />
        </div>
      )}

      <div className="h-evo-grid">
        {cells.map(({ label, value, cls, sub }) => (
          <div key={label} className="h-evo-cell">
            <span className="h-evo-label">{label}</span>
            <span className={`h-evo-value ${cls}`}>{value}</span>
            {sub && <span className="h-evo-sub">{sub}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HomeEvolution;
