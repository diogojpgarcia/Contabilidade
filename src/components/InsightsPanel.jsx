import React, { useMemo } from 'react';
import { getTopCategories, detectRecurring, buildBarData, computeMonthAnalytics, getLastNMonths } from '../utils/analytics.js';
import { forecastNextMonth } from '../utils/forecasting.js';
import { generateAlerts } from '../utils/alerts.js';
import './InsightsPanel.css';

const CATEGORY_COLORS = [
  '#F59E0B','#3B82F6','#10B981','#EF4444','#8B5CF6',
  '#EC4899','#14B8A6','#F97316','#6366F1','#84CC16',
];

const InsightsPanel = ({ transactions, currentMonth }) => {
  const alerts    = useMemo(() => generateAlerts(transactions, currentMonth), [transactions, currentMonth]);
  const topCats   = useMemo(() => getTopCategories(transactions, currentMonth, 5), [transactions, currentMonth]);
  const recurring = useMemo(() => detectRecurring(transactions).slice(0, 5), [transactions]);
  const forecast  = useMemo(() => forecastNextMonth(transactions, currentMonth), [transactions, currentMonth]);
  const barData   = useMemo(() => buildBarData(transactions, currentMonth, 6), [transactions, currentMonth]);

  const curAnalytics  = useMemo(() => computeMonthAnalytics(transactions, currentMonth), [transactions, currentMonth]);
  const prevMonths    = useMemo(() => getLastNMonths(currentMonth, 2), [currentMonth]);
  const prevAnalytics = useMemo(() => computeMonthAnalytics(transactions, prevMonths[0]), [transactions, prevMonths]);

  const maxBar = Math.max(...barData.map(d => Math.max(d.income, d.expenses)), 1);

  return (
    <div className="insights-scroll">

      {/* Alerts */}
      {alerts.length > 0 && (
        <section className="insights-section">
          <div className="insights-section-title">
            <span className="insights-icon">⚠</span> Alertas
          </div>
          <div className="insights-alerts-list">
            {alerts.map((a, i) => (
              <div key={i} className={`insights-alert insights-alert-${a.type}`}>
                <span className="insights-alert-dot" />
                <span className="insights-alert-msg">{a.message}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Monthly trend mini bar chart */}
      <section className="insights-section">
        <div className="insights-section-title">
          <span className="insights-icon">◧</span> Evolução 6 Meses
        </div>
        <div className="insights-bar-chart">
          {barData.map((d, i) => (
            <div key={i} className="insights-bar-group">
              <div className="insights-bar-pair">
                <div
                  className="insights-bar income"
                  style={{ height: `${(d.income / maxBar) * 64}px` }}
                  title={`Receita: ${d.income.toFixed(0)}€`}
                />
                <div
                  className="insights-bar expense"
                  style={{ height: `${(d.expenses / maxBar) * 64}px` }}
                  title={`Despesa: ${d.expenses.toFixed(0)}€`}
                />
              </div>
              <span className="insights-bar-label">{d.month}</span>
            </div>
          ))}
        </div>
        <div className="insights-bar-legend">
          <span className="insights-legend-dot income" /> Receitas
          <span className="insights-legend-dot expense" style={{ marginLeft: '1rem' }} /> Despesas
        </div>
      </section>

      {/* Top spending categories */}
      {topCats.length > 0 && (
        <section className="insights-section">
          <div className="insights-section-title">
            <span className="insights-icon">◭</span> Top Categorias
          </div>
          <div className="insights-categories-list">
            {topCats.map(({ category, amount, percentage }, i) => (
              <div key={i} className="insights-category-row">
                <div className="insights-category-info">
                  <span className="insights-category-dot" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                  <span className="insights-category-name">{category}</span>
                </div>
                <div className="insights-category-right">
                  <div className="insights-category-bar-track">
                    <div
                      className="insights-category-bar-fill"
                      style={{ width: `${percentage}%`, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                    />
                  </div>
                  <span className="insights-category-amount">{amount.toFixed(0)}€</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Month comparison */}
      <section className="insights-section">
        <div className="insights-section-title">
          <span className="insights-icon">◈</span> Este Mês vs Anterior
        </div>
        <div className="insights-compare-grid">
          {[
            { label: 'Receitas', cur: curAnalytics.income, prev: prevAnalytics.income, positive: true },
            { label: 'Despesas', cur: curAnalytics.expenses, prev: prevAnalytics.expenses, positive: false },
            { label: 'Saldo',    cur: curAnalytics.balance,  prev: prevAnalytics.balance, positive: true },
          ].map(({ label, cur, prev, positive }) => {
            const delta = prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null;
            const good = delta === null ? null : positive ? delta >= 0 : delta <= 0;
            return (
              <div key={label} className="insights-compare-card">
                <span className="insights-compare-label">{label}</span>
                <span className="insights-compare-value">{cur.toFixed(0)}€</span>
                {delta !== null && (
                  <span className={`insights-compare-delta ${good ? 'good' : 'bad'}`}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(0)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Forecast */}
      {forecast && (
        <section className="insights-section">
          <div className="insights-section-title">
            <span className="insights-icon">◐</span> Previsão Próximo Mês
          </div>
          <div className="insights-forecast-card">
            <div className="insights-forecast-main">
              <span className="insights-forecast-label">Despesas estimadas</span>
              <span className="insights-forecast-amount">{forecast.total.toFixed(2)}€</span>
              <span className={`insights-forecast-trend ${forecast.trend >= 0 ? 'up' : 'down'}`}>
                {forecast.trend >= 0 ? '▲' : '▼'} {Math.abs(forecast.trend)}% tendência
              </span>
              <span className="insights-forecast-confidence">Confiança: {forecast.confidence}</span>
            </div>
            <div className="insights-forecast-cats">
              {Object.entries(forecast.byCategory)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([cat, val]) => (
                  <div key={cat} className="insights-forecast-cat-row">
                    <span className="insights-forecast-cat-name">{cat}</span>
                    <span className="insights-forecast-cat-val">{val.toFixed(0)}€</span>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* Recurring payments */}
      {recurring.length > 0 && (
        <section className="insights-section insights-section-last">
          <div className="insights-section-title">
            <span className="insights-icon">◉</span> Pagamentos Recorrentes
          </div>
          <div className="insights-recurring-list">
            {recurring.map((r, i) => (
              <div key={i} className="insights-recurring-row">
                <div className="insights-recurring-info">
                  <span className="insights-recurring-desc">{r.description}</span>
                  <span className="insights-recurring-meta">{r.occurrences}× · último {r.lastDate}</span>
                </div>
                <span className={`insights-recurring-amount ${r.type}`}>
                  {r.type === 'income' ? '+' : '-'}{r.amount.toFixed(2)}€
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
};

export default InsightsPanel;
