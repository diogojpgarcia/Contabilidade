/**
 * ExportModal.jsx — Gera PDF com 1 clique.
 * Período + modo + AI toggle → Gerar PDF.
 */
import React, { useState, useMemo } from 'react';
import Overlay from '../Overlay';
import './ExportModal.css';
import { useAppContext } from '../../context/AppContext';
import { useAIInsights } from '../../hooks/useAIInsights';
import {
  generateInsights, computeFinancialScore,
  buildInsightsSummary, shiftMonth, formatMonthLabel,
} from '../../utils/insights';
import { PATRIMONY_TYPES, toNum } from '../../utils/budgetUtils';
import { isInFinancialMonth } from '../../utils/financialMonth';

function getStoredTypeValue(key, patrimony) {
  const items = (patrimony || {})[key] || [];
  if (key === 'realestate') return items.reduce((s, x) => s + toNum(x.value), 0);
  if (key === 'accounts')   return items.reduce((s, x) => s + toNum(x.balance || 0), 0);
  if (key === 'bonds')      return items.reduce((s, x) => s + toNum(x.faceValue || x.value), 0);
  if (key === 'vehicles')   return items.reduce((s, x) => s + toNum(x.value), 0);
  if (key === 'stocks' || key === 'etfs')
    return items.reduce((s, x) => s + toNum(x.qty) * toNum(x.lastPrice ?? x.avgPrice ?? x.purchasePrice), 0);
  if (key === 'crypto')
    return items.reduce((s, x) => s + toNum(x.qty) * toNum(x.lastPrice ?? x.price ?? x.purchasePrice), 0);
  return 0;
}

const PERIOD_OPTIONS = (m) => [
  { value: m,                  label: `Este mês — ${formatMonthLabel(m)}` },
  { value: shiftMonth(m, -1),  label: `Mês anterior — ${formatMonthLabel(shiftMonth(m, -1))}` },
  { value: shiftMonth(m, -2),  label: `2 meses atrás — ${formatMonthLabel(shiftMonth(m, -2))}` },
  { value: shiftMonth(m, -3),  label: `3 meses atrás — ${formatMonthLabel(shiftMonth(m, -3))}` },
  { value: '__q__',            label: 'Último trimestre (3 meses)' },
  { value: '__s__',            label: 'Último semestre (6 meses)' },
  { value: '__y__',            label: `Ano ${new Date().getFullYear()}` },
];

export default function ExportModal({ open, onClose, transactions, patrimony, budgets, currentMonth, financialMonthStartDay }) {
  const { categories } = useAppContext();
  const [period,     setPeriod]     = useState(currentMonth);
  const [mode,       setMode]       = useState('summary');
  const [includeAI,  setIncludeAI]  = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState(null);

  const isMultiMonth = period === '__q__' || period === '__s__' || period === '__y__';
  const singleMonth  = isMultiMonth ? currentMonth : period;

  // Monthly chart data (last 6 months for bar chart)
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => shiftMonth(currentMonth, -(5 - i)));
    return months.map(m => {
      const txns     = transactions.filter(t => t.date && isInFinancialMonth(t.date, m, financialMonthStartDay));
      const income   = txns.filter(t => t.type === 'income') .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const [, mm]   = m.split('-');
      const label    = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][parseInt(mm) - 1];
      return { label, income: Math.round(income), expenses: Math.round(expenses) };
    });
  }, [currentMonth, transactions, financialMonthStartDay]);

  const summary = useMemo(() =>
    buildInsightsSummary({ transactions, budgets, categories, patrimony, selectedMonth: singleMonth, startDay: financialMonthStartDay }),
    [singleMonth, transactions, budgets, categories, patrimony, financialMonthStartDay]
  );

  const multiSummary = useMemo(() => {
    if (!isMultiMonth) return null;
    const n      = period === '__q__' ? 3 : period === '__s__' ? 6 : new Date().getMonth() + 1;
    const months = Array.from({ length: n }, (_, i) => shiftMonth(currentMonth, -(n - 1 - i)));
    let income = 0, expenses = 0;
    const byCat = {};
    for (const m of months) {
      const txns = transactions.filter(t => t.date && isInFinancialMonth(t.date, m, financialMonthStartDay));
      txns.filter(t => t.type === 'income') .forEach(t => { income   += parseFloat(t.amount) || 0; });
      txns.filter(t => t.type === 'expense').forEach(t => {
        expenses += parseFloat(t.amount) || 0;
        byCat[t.category] = (byCat[t.category] || 0) + (parseFloat(t.amount) || 0);
      });
    }
    income   = Math.round(income);
    expenses = Math.round(expenses);
    const savings     = income - expenses;
    const savingsRate = income > 0 ? Math.round((savings / income) * 100) : null;
    const topCats     = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, amount]) => ({ name, amount: Math.round(amount), pct: expenses > 0 ? Math.round((amount / expenses) * 100) : 0 }));
    const label = period === '__q__' ? 'Último Trimestre' : period === '__s__' ? 'Último Semestre' : `Ano ${new Date().getFullYear()}`;
    return { period: label, income, expenses, savings, savingsRate, expenseTrend: null, topCategories: topCats, budgetBreaches: [], patrimonyTotal: summary.patrimonyTotal };
  }, [period, isMultiMonth, currentMonth, transactions, financialMonthStartDay, summary.patrimonyTotal]); // eslint-disable-line

  const activeSummary = isMultiMonth ? multiSummary : summary;
  const periodLabel   = isMultiMonth ? activeSummary?.period : formatMonthLabel(singleMonth, financialMonthStartDay);

  const allInsights = useMemo(() =>
    generateInsights({ transactions, budgets, categories, selectedMonth: singleMonth, startDay: financialMonthStartDay, maxResults: 0 }),
    [singleMonth, transactions, budgets, categories, financialMonthStartDay]
  );

  const score = useMemo(() =>
    computeFinancialScore({ transactions, budgets, categories, selectedMonth: singleMonth, startDay: financialMonthStartDay }),
    [singleMonth, transactions, budgets, categories, financialMonthStartDay]
  );

  const patrimonyByType = useMemo(() =>
    PATRIMONY_TYPES.map(t => ({ ...t, value: getStoredTypeValue(t.key, patrimony) })),
    [patrimony]
  );
  const patrimonyTotal = useMemo(() =>
    patrimonyByType.reduce((s, t) => s + t.value, 0),
    [patrimonyByType]
  );

  // Fetch AI silently in background — include in PDF if ready when user clicks
  const { data: aiData, loading: aiLoading } = useAIInsights(
    includeAI && activeSummary ? activeSummary : null,
    includeAI ? allInsights.slice(0, 5) : []
  );

  const handleGenerate = async () => {
    if (!activeSummary) return;
    setGenerating(true);
    setGenError(null);
    try {
      const { generateFinancialReport } = await import('../../utils/generateReport.js');
      await generateFinancialReport({
        period:          periodLabel,
        mode,
        income:          activeSummary.income,
        expenses:        activeSummary.expenses,
        savings:         activeSummary.savings,
        savingsRate:     activeSummary.savingsRate,
        expenseTrend:    activeSummary.expenseTrend,
        topCategories:   activeSummary.topCategories,
        monthlyData,
        patrimonyByType: patrimonyByType.filter(t => t.value > 0),
        patrimonyTotal,
        insights:        allInsights,
        score,
        aiInsights:      includeAI && aiData ? aiData : null,
        appName:         'Finanças',
      });
    } catch (err) {
      console.error('[ExportModal]', err);
      setGenError('Erro ao gerar PDF. Corre npm install jspdf jspdf-autotable no projeto.');
    } finally {
      setGenerating(false);
    }
  };

  if (!open) return null;

  return (
    <Overlay onClose={onClose}>
      <div className="modal-content export-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h4>Exportar Relatório PDF</h4>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="export-body">

          <div className="export-field">
            <label className="export-label">Período</label>
            <select className="export-select" value={period} onChange={e => setPeriod(e.target.value)}>
              {PERIOD_OPTIONS(currentMonth).map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="export-mode-row">
            {[
              { v: 'summary',  l: 'Sintético',  d: '1-2 páginas · top 3 categorias · 4 insights' },
              { v: 'detailed', l: 'Detalhado',   d: 'Completo · gráfico · tabela · todos os insights' },
            ].map(o => (
              <button
                key={o.v}
                className={`export-mode-btn${mode === o.v ? ' active' : ''}`}
                onClick={() => setMode(o.v)}
              >
                <span className="export-mode-name">{o.l}</span>
                <span className="export-mode-desc">{o.d}</span>
              </button>
            ))}
          </div>

          <div className="export-toggle-row">
            <div>
              <div className="export-label">Incluir análise AI</div>
              <div className="export-sublabel">
                {aiLoading ? '⏳ A preparar…' : aiData ? '✓ Pronta para incluir' : includeAI ? 'Será incluída se pronta' : 'Desativada'}
              </div>
            </div>
            <button className={`export-toggle${includeAI ? ' on' : ''}`} onClick={() => setIncludeAI(v => !v)}>
              <span className="export-toggle-knob" />
            </button>
          </div>

          {genError && <div className="export-error">{genError}</div>}

          <button
            className="export-btn-generate"
            onClick={handleGenerate}
            disabled={generating || !activeSummary}
          >
            {generating ? '⏳ A gerar…' : '📄 Gerar PDF'}
          </button>

        </div>
      </div>
    </Overlay>
  );
}
