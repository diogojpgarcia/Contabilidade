/**
 * generateReport.js — client-side PDF generation.
 * Requires: npm install jspdf jspdf-autotable
 *
 * Philosophy: every number has context.
 * Charts: monthly bar chart + category donut drawn with jsPDF primitives.
 */

import { jsPDF }  from 'jspdf';
import autoTable  from 'jspdf-autotable';

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  primary:  [79,  70,  229],
  income:   [22, 163,  74],
  expense:  [220,  38,  38],
  warning:  [202, 138,   4],
  neutral:  [100, 116, 139],
  text1:    [15,  23,  42],
  text2:    [71,  85, 105],
  text3:    [148, 163, 184],
  bg:       [248, 250, 252],
  bgCard:   [241, 245, 249],
  border:   [226, 232, 240],
  white:    [255, 255, 255],
  purple:   [124,  58, 237],
};

// Distinct colours for category donut
const CAT_COLORS = [
  [79, 70, 229], [22, 163, 74], [220, 38, 38],
  [202, 138, 4], [124, 58, 237], [8, 145, 178],
  [190, 18, 60], [21, 128, 61],
];

const scoreColor = (s) =>
  s >= 80 ? [22,163,74] : s >= 60 ? [202,138,4] : s >= 40 ? [234,88,12] : [220,38,38];

const fmtPT  = (n, dec = 2) =>
  (n || 0).toLocaleString('pt-PT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmt0   = (n) => Math.round(Math.abs(n || 0)).toLocaleString('pt-PT');
const fmtPct = (n) => (n >= 0 ? '+' : '') + (n || 0).toFixed(1) + '%';
const sign   = (n) => n >= 0 ? '+' : '−';

function humaniseDaily(daily) {
  if (daily < 3)   return `${fmtPT(daily)}€/dia`;
  if (daily < 10)  return `${fmtPT(daily)}€/dia (< 1 refeição)`;
  if (daily < 20)  return `${fmtPT(daily)}€/dia (~1 refeição)`;
  if (daily < 50)  return `${fmtPT(daily)}€/dia (~2 refeições)`;
  return `${fmtPT(daily)}€/dia`;
}

// ── Layout ────────────────────────────────────────────────────────────────────
const PAGE_W = 210;
const PAGE_H = 297;
const M      = 14;
const W      = PAGE_W - M * 2;

let _doc;

function ensurePage(y, needed = 24) {
  if (y + needed > PAGE_H - M - 8) {
    _doc.addPage();
    return M + 2;
  }
  return y;
}

function sectionTitle(y, n, title, subtitle) {
  _doc.setFillColor(...C.primary);
  _doc.roundedRect(M, y, W, 9, 2, 2, 'F');
  _doc.setFont('helvetica', 'bold');
  _doc.setFontSize(9);
  _doc.setTextColor(...C.white);
  _doc.text(`${n}. ${title.toUpperCase()}`, M + 4, y + 6);
  if (subtitle) {
    _doc.setFont('helvetica', 'normal');
    _doc.setFontSize(7);
    _doc.setTextColor(200, 210, 255);
    _doc.text(subtitle, PAGE_W - M - 2, y + 6, { align: 'right' });
  }
  return y + 13;
}

function kpiTile(x, y, w, h, label, value, sub, valueCol) {
  _doc.setFillColor(...C.bgCard);
  _doc.setDrawColor(...C.border);
  _doc.roundedRect(x, y, w, h, 3, 3, 'FD');
  _doc.setFont('helvetica', 'normal');
  _doc.setFontSize(6.5);
  _doc.setTextColor(...C.text3);
  _doc.text(label, x + w / 2, y + 4.5, { align: 'center' });
  _doc.setFont('helvetica', 'bold');
  _doc.setFontSize(12);
  _doc.setTextColor(...(valueCol || C.text1));
  _doc.text(value, x + w / 2, y + h - (sub ? 6 : 4), { align: 'center' });
  if (sub) {
    _doc.setFont('helvetica', 'normal');
    _doc.setFontSize(6.5);
    _doc.setTextColor(...C.text3);
    _doc.text(sub, x + w / 2, y + h - 2, { align: 'center' });
  }
}

function callout(y, emoji, headline, body, accentColor) {
  const lines  = _doc.splitTextToSize(body, W - 22);
  const height = 8 + lines.length * 4;
  _doc.setFillColor(...accentColor);
  _doc.roundedRect(M, y, 3, height, 1, 1, 'F');
  _doc.setFillColor(accentColor[0], accentColor[1], accentColor[2], 0.06);
  _doc.roundedRect(M + 3, y, W - 3, height, 0, 2, 'F');
  _doc.setFont('helvetica', 'bold');
  _doc.setFontSize(8);
  _doc.setTextColor(...C.text1);
  _doc.text(`${emoji}  ${headline}`, M + 7, y + 5.5);
  _doc.setFont('helvetica', 'normal');
  _doc.setFontSize(7.5);
  _doc.setTextColor(...C.text2);
  _doc.text(lines, M + 7, y + 10);
  return y + height + 4;
}

function insightBlock(y, ins) {
  const typeColor =
    ins.color === 'risk' ? C.expense :
    ins.color === 'warn' ? C.warning :
    ins.color === 'good' ? C.income  : C.neutral;
  const emoji =
    ins.color === 'risk' ? '⚠' :
    ins.color === 'warn' ? '⚡' :
    ins.color === 'good' ? '↑' : '•';

  const bodyText = [ins.message, ins.explanation].filter(Boolean).join(' — ');
  const lines    = _doc.splitTextToSize(bodyText, W - 24);
  const h        = 7 + lines.length * 3.8 + 1;
  y = ensurePage(y, h + 4);

  _doc.setFillColor(...typeColor);
  _doc.rect(M, y, 2.5, h, 'F');
  _doc.setFillColor(...C.bg);
  _doc.roundedRect(M + 2.5, y, W - 2.5, h, 0, 2, 'F');
  _doc.setFont('helvetica', 'bold');
  _doc.setFontSize(7.5);
  _doc.setTextColor(...C.text1);
  _doc.text(`${emoji}  ${ins.title}`, M + 6, y + 5);
  _doc.setFont('helvetica', 'normal');
  _doc.setFontSize(7);
  _doc.setTextColor(...C.text2);
  _doc.text(lines, M + 6, y + 9.5);
  return y + h + 3;
}

// ── Chart: Monthly income vs expense bars ─────────────────────────────────────
/**
 * @param {number} y          top of chart area
 * @param {array}  monthly    [{label, income, expenses}]
 * @returns {number}          y after chart
 */
function drawMonthlyBarChart(y, monthly) {
  if (!monthly?.length) return y;

  const chartH = 48;
  const chartW = W;
  const barAreaH = chartH - 12; // leave 12px for x-labels
  const maxVal   = Math.max(...monthly.flatMap(m => [m.income || 0, m.expenses || 0]), 1);
  const n        = monthly.length;
  const groupW   = chartW / n;
  const barW     = Math.min((groupW - 4) / 2, 10);
  const gap      = 1.5;

  // Axis
  _doc.setDrawColor(...C.border);
  _doc.setLineWidth(0.3);
  _doc.line(M, y + barAreaH, M + chartW, y + barAreaH);

  // Gridlines
  _doc.setDrawColor(...C.border);
  _doc.setLineWidth(0.2);
  for (let g = 1; g <= 3; g++) {
    const gy = y + barAreaH - (barAreaH * g / 4);
    _doc.line(M, gy, M + chartW, gy);
    _doc.setFont('helvetica', 'normal');
    _doc.setFontSize(5.5);
    _doc.setTextColor(...C.text3);
    _doc.text(fmt0(maxVal * g / 4), M - 1, gy + 1.5, { align: 'right' });
  }

  // Bars
  monthly.forEach((m, i) => {
    const cx    = M + i * groupW + groupW / 2;
    const incH  = barAreaH * Math.min((m.income  || 0) / maxVal, 1);
    const expH  = barAreaH * Math.min((m.expenses || 0) / maxVal, 1);
    const incX  = cx - barW - gap / 2;
    const expX  = cx + gap / 2;

    // Income bar (green)
    if (incH > 0) {
      _doc.setFillColor(...C.income);
      _doc.roundedRect(incX, y + barAreaH - incH, barW, incH, 1, 1, 'F');
    }
    // Expense bar (red)
    if (expH > 0) {
      _doc.setFillColor(...C.expense);
      _doc.roundedRect(expX, y + barAreaH - expH, barW, expH, 1, 1, 'F');
    }

    // X label
    _doc.setFont('helvetica', 'normal');
    _doc.setFontSize(5.5);
    _doc.setTextColor(...C.text3);
    _doc.text(m.label || '', cx, y + barAreaH + 5, { align: 'center' });
  });

  // Legend
  const legY = y + chartH - 3;
  _doc.setFillColor(...C.income);
  _doc.rect(M + chartW - 36, legY - 2.5, 5, 3, 'F');
  _doc.setFont('helvetica', 'normal');
  _doc.setFontSize(6);
  _doc.setTextColor(...C.text2);
  _doc.text('Receitas', M + chartW - 29, legY);

  _doc.setFillColor(...C.expense);
  _doc.rect(M + chartW - 16, legY - 2.5, 5, 3, 'F');
  _doc.text('Despesas', M + chartW - 9, legY);

  return y + chartH + 4;
}

// ── Chart: Category donut ─────────────────────────────────────────────────────
/**
 * Draws a donut chart + legend for top categories.
 * @param {number} y
 * @param {array}  categories  [{name, amount, pct}]
 * @param {number} total
 * @returns {number} y after chart
 */
function drawCategoryDonut(y, categories, total) {
  if (!categories?.length || !total) return y;

  const cx = M + 28;
  const cy = y + 28;
  const R  = 22;
  const r  = 13; // inner radius (donut hole)

  // Draw segments using PDF arc approximation
  // jsPDF doesn't have native arc, so we use lines to approximate a donut
  // We use a polygon approximation with many segments
  let startAngle = -Math.PI / 2; // start at top

  categories.slice(0, 8).forEach((cat, i) => {
    const angle   = (cat.pct / 100) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const col     = CAT_COLORS[i % CAT_COLORS.length];

    // Build donut segment as filled polygon
    const steps = Math.max(8, Math.round(angle * 20));
    const pts   = [];

    // Outer arc
    for (let s = 0; s <= steps; s++) {
      const a = startAngle + (angle * s) / steps;
      pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    // Inner arc (reverse)
    for (let s = steps; s >= 0; s--) {
      const a = startAngle + (angle * s) / steps;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }

    if (pts.length > 2) {
      _doc.setFillColor(...col);
      _doc.setDrawColor(...C.white);
      _doc.setLineWidth(0.4);
      // Use lines to draw polygon
      _doc.lines(
        pts.slice(1).map((p, idx) => [p[0] - pts[idx][0], p[1] - pts[idx][1]]),
        pts[0][0], pts[0][1],
        [1, 1], 'FD', true
      );
    }

    startAngle = endAngle;
  });

  // Centre total label
  _doc.setFont('helvetica', 'bold');
  _doc.setFontSize(7.5);
  _doc.setTextColor(...C.text1);
  _doc.text(fmt0(total) + '€', cx, cy + 1.5, { align: 'center' });
  _doc.setFont('helvetica', 'normal');
  _doc.setFontSize(5.5);
  _doc.setTextColor(...C.text3);
  _doc.text('total', cx, cy + 5.5, { align: 'center' });

  // Legend to the right
  const legX   = M + 60;
  const legTop = y + 4;
  categories.slice(0, Math.min(8, categories.length)).forEach((cat, i) => {
    const col = CAT_COLORS[i % CAT_COLORS.length];
    const ly  = legTop + i * 7;
    _doc.setFillColor(...col);
    _doc.roundedRect(legX, ly, 4, 4, 1, 1, 'F');
    _doc.setFont('helvetica', 'bold');
    _doc.setFontSize(7);
    _doc.setTextColor(...C.text1);
    _doc.text(`${cat.name}`, legX + 6, ly + 3.5);
    _doc.setFont('helvetica', 'normal');
    _doc.setFontSize(6.5);
    _doc.setTextColor(...C.text3);
    const valStr = `${fmt0(cat.amount)}€ · ${cat.pct}%`;
    _doc.text(valStr, PAGE_W - M - 2, ly + 3.5, { align: 'right' });
  });

  return y + Math.max(60, categories.slice(0, 8).length * 7 + 8);
}

// ── Main ──────────────────────────────────────────────────────────────────────
/**
 * @param {object} opts
 *   period, mode, income, expenses, savings, savingsRate, expenseTrend,
 *   topCategories [{name,amount,pct}],
 *   monthlyData [{label, income, expenses}]  ← last 6 months
 *   patrimonyByType [{label/key, value}],
 *   patrimonyTotal, insights[], score {score,label},
 *   aiInsights {summary,narrative,recommendations,outlook} | null,
 *   appName
 */
export async function generateFinancialReport(opts) {
  const {
    period           = 'Período',
    mode             = 'summary',
    income           = 0,
    expenses         = 0,
    savings          = 0,
    savingsRate      = null,
    expenseTrend     = null,
    topCategories    = [],
    monthlyData      = [],
    patrimonyByType  = [],
    patrimonyTotal   = 0,
    insights         = [],
    score            = { score: 0, label: '—' },
    aiInsights       = null,
    appName          = 'Finanças',
  } = opts;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  _doc = doc;
  let y = 0;

  // ── CAPA ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, PAGE_W, 44, 'F');
  // Diagonal accent
  doc.setFillColor(120, 115, 245);
  doc.triangle(PAGE_W - 55, 0, PAGE_W, 0, PAGE_W, 44, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.white);
  doc.text(appName, M, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(200, 210, 255);
  doc.text(`Relatório ${mode === 'detailed' ? 'Detalhado' : 'Sintético'}`, M, 27);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.white);
  doc.text(period, M, 36);
  const now = new Date().toLocaleDateString('pt-PT', { day:'2-digit', month:'long', year:'numeric' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(180, 190, 240);
  doc.text(`Gerado em ${now}`, PAGE_W - M, 40, { align: 'right' });

  y = 52;

  // ── SCORE BADGE ───────────────────────────────────────────────────────────
  const sc   = score.score || 0;
  const sCol = scoreColor(sc);
  doc.setDrawColor(...sCol);
  doc.setLineWidth(2);
  doc.circle(PAGE_W - M - 14, y + 10, 14, 'S');
  doc.setFillColor(...C.white);
  doc.circle(PAGE_W - M - 14, y + 10, 11, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...sCol);
  doc.text(String(sc), PAGE_W - M - 14, y + 12.5, { align: 'center' });
  doc.setFontSize(6);
  doc.setTextColor(...C.text3);
  doc.text('/100', PAGE_W - M - 14, y + 17, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.text1);
  doc.text('Score Financeiro', M, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.text2);
  const scoreLines = doc.splitTextToSize(score.label || '', PAGE_W - M * 2 - 32);
  doc.text(scoreLines, M, y + 12);
  y += 32;

  // ── 1. DESTAQUES ──────────────────────────────────────────────────────────
  y = sectionTitle(y, '1', 'Destaques do Período');

  const dailyExpense  = expenses > 0 ? expenses / 30 : 0;
  const annualSavings = savings * 12;
  const coveredMonths = dailyExpense > 0 && patrimonyTotal > 0
    ? (patrimonyTotal / expenses).toFixed(1) : null;

  if (savings >= 0) {
    y = callout(y, '💰', `Poupaste ${fmt0(savings)}€ este período`,
      savingsRate != null
        ? `Taxa de poupança de ${savingsRate}%. Ao manter este ritmo, em 12 meses acumulas ${fmt0(annualSavings)}€ adicionais.${expenseTrend != null && expenseTrend <= 0 ? ` Despesas desceram ${Math.abs(expenseTrend)}% vs mês anterior — boa tendência.` : ''}`
        : `Se mantiveres este ritmo, acumulas ${fmt0(annualSavings)}€ no próximo ano.`,
      C.income);
  } else {
    y = callout(y, '🔴', `Défice de ${fmt0(Math.abs(savings))}€ este período`,
      `Gastaste ${fmt0(Math.abs(savings))}€ a mais do que recebeste.${expenseTrend != null ? ` Despesas variaram ${fmtPct(expenseTrend)} vs o mês anterior.` : ''} Um défice mensal recorrente acelera o consumo de poupanças.`,
      C.expense);
  }

  if (dailyExpense > 1) {
    const topExtra = topCategories[0]
      ? ` Maior categoria: ${topCategories[0].name} com ${fmt0(topCategories[0].amount)}€ (${topCategories[0].pct}%).`
      : '';
    y = callout(y, '📊', `Ritmo médio: ${humaniseDaily(dailyExpense)}`,
      `Num mês de 30 dias equivale a ${fmt0(expenses)}€ em despesas.${topExtra}${expenseTrend != null ? ` Tendência: ${fmtPct(expenseTrend)}.` : ''}`,
      C.neutral);
  }

  if (patrimonyTotal > 1000 && expenses > 0) {
    y = callout(y, '🏦', `O teu património cobre ${coveredMonths} meses de despesas`,
      `${fmt0(patrimonyTotal)}€ de património com ${fmt0(expenses)}€/mês de despesas. ${parseFloat(coveredMonths) < 3 ? 'Especialistas recomendam 3-6 meses de reserva.' : parseFloat(coveredMonths) < 6 ? 'Próximo da zona segura (6 meses).' : 'Estás na zona segura de reserva de emergência.'}`,
      C.purple);
  }
  y += 2;

  // ── 2. RESUMO FINANCEIRO ──────────────────────────────────────────────────
  y = ensurePage(y, 55);
  y = sectionTitle(y, '2', 'Resumo Financeiro', period);

  const tW3 = (W - 6) / 3;
  kpiTile(M,             y, tW3, 22, 'RECEITAS',  `+${fmtPT(income)}€`,  null, C.income);
  kpiTile(M + tW3 + 3,   y, tW3, 22, 'DESPESAS',  `−${fmtPT(expenses)}€`, null, C.expense);
  kpiTile(M + (tW3+3)*2, y, tW3, 22,
    savings >= 0 ? 'SALDO' : 'DÉFICE',
    `${sign(savings)}${fmtPT(Math.abs(savings))}€`,
    expenseTrend != null ? `${fmtPct(expenseTrend)} vs mês ant.` : null,
    savings >= 0 ? C.income : C.expense);
  y += 26;

  if (savingsRate != null || expenseTrend != null) {
    const tW2 = (W - 3) / 2;
    if (savingsRate != null)
      kpiTile(M, y, tW2, 18, 'TAXA DE POUPANÇA',
        `${savingsRate}%`,
        savingsRate >= 20 ? '✓ acima do objetivo' : savingsRate >= 10 ? 'abaixo de 20%' : '⚠ abaixo de 10%',
        savingsRate >= 20 ? C.income : savingsRate >= 10 ? C.warning : C.expense);
    if (expenseTrend != null)
      kpiTile(M + tW2 + 3, y, tW2, 18, 'DESPESAS vs MÊS ANT.',
        (expenseTrend >= 0 ? '+' : '') + expenseTrend + '%',
        expenseTrend <= 0 ? 'menos despesas ✓' : expenseTrend <= 10 ? 'ligeiro aumento' : 'aumento significativo',
        expenseTrend <= 0 ? C.income : expenseTrend <= 10 ? C.warning : C.expense);
    y += 22;
  }

  if (income > 0 && expenses > 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.text3);
    const ctxParts = [];
    if (savingsRate != null) ctxParts.push(`De cada 100€ recebidos, gastas ${Math.round(expenses / income * 100)}€ e guardas ${savingsRate}€`);
    if (dailyExpense > 0)    ctxParts.push(`despesa diária: ${humaniseDaily(dailyExpense)}`);
    if (annualSavings !== 0) ctxParts.push(`projeção anual: ${sign(savings)}${fmt0(Math.abs(annualSavings))}€`);
    if (ctxParts.length) { doc.text(ctxParts.join(' · '), M, y); y += 7; }
  }
  y += 2;

  // ── 3. EVOLUÇÃO MENSAL (BAR CHART) ────────────────────────────────────────
  if (monthlyData.length >= 2) {
    y = ensurePage(y, 72);
    y = sectionTitle(y, '3', 'Evolução dos Últimos Meses', `${monthlyData.length} meses`);
    y = drawMonthlyBarChart(y, monthlyData);
    y += 2;
  }

  // ── 4. TOP CATEGORIAS + DONUT ─────────────────────────────────────────────
  if (topCategories.length > 0) {
    y = ensurePage(y, 70);
    const secN = monthlyData.length >= 2 ? '4' : '3';
    y = sectionTitle(y, secN, 'Top Categorias de Despesa', `total: ${fmt0(expenses)}€`);

    // Donut chart
    y = drawCategoryDonut(y, topCategories, expenses);
    y += 4;

    // Table with contextual column
    const catRows = topCategories.map((c, i) => {
      const annualEq = fmt0(c.amount * 12);
      const ctx      = `${c.pct}% das despesas · ${annualEq}€/ano`;
      return [`${i + 1}. ${c.name}`, `${fmt0(c.amount)}€`, ctx];
    });
    autoTable(doc, {
      startY:  y,
      head:    [['Categoria', 'Valor', 'Contexto']],
      body:    catRows,
      margin:  { left: M, right: M },
      styles:  { fontSize: 8, cellPadding: 3, textColor: C.text1, overflow: 'linebreak' },
      headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: C.bg },
      columnStyles: {
        0: { cellWidth: W * 0.30, fontStyle: 'bold' },
        1: { cellWidth: W * 0.18, halign: 'right', fontStyle: 'bold' },
        2: { cellWidth: W * 0.52, textColor: C.text3, fontSize: 7 },
      },
    });
    y = doc.lastAutoTable.finalY + 4;

    if (topCategories[0] && income > 0) {
      const top    = topCategories[0];
      const incPct = Math.round((top.amount / income) * 100);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.text3);
      doc.text(`▸ ${top.name}: ${top.pct}% das despesas · ${incPct}% do rendimento · ${fmt0(top.amount * 12)}€/ano.`, M, y);
      y += 7;
    }
  }

  // ── 5. PATRIMÔNIO ─────────────────────────────────────────────────────────
  if (patrimonyByType.filter(t => t.value > 0).length > 0) {
    const secN = topCategories.length > 0 ? (monthlyData.length >= 2 ? '5' : '4') : (monthlyData.length >= 2 ? '4' : '3');
    y = ensurePage(y, 55);
    y = sectionTitle(y, secN, 'Snapshot de Património', 'preços armazenados');

    doc.setFillColor(...C.bgCard);
    doc.setDrawColor(...C.border);
    doc.roundedRect(M, y, W, 16, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.text2);
    doc.text('TOTAL ESTIMADO', M + 4, y + 7);
    doc.setFontSize(15);
    doc.setTextColor(...C.primary);
    doc.text(`${fmtPT(patrimonyTotal)}€`, PAGE_W - M - 4, y + 11, { align: 'right' });
    if (expenses > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.text3);
      doc.text(`cobre ${(patrimonyTotal / expenses).toFixed(1)} meses de despesas`, PAGE_W - M - 4, y + 14.5, { align: 'right' });
    }
    y += 20;

    const patRows = patrimonyByType
      .filter(t => t.value > 0)
      .sort((a, b) => b.value - a.value)
      .map(t => {
        const pct    = patrimonyTotal > 0 ? Math.round((t.value / patrimonyTotal) * 100) : 0;
        const eqMonths = savings > 0 ? `${fmt0(t.value / Math.max(savings, 1))} meses de poupança` : '—';
        return [t.label || t.key, `${fmtPT(t.value)}€`, `${pct}%`, eqMonths];
      });

    autoTable(doc, {
      startY: y,
      head:   [['Tipo de Ativo', 'Valor', '% Total', 'Equivalência']],
      body:   patRows,
      margin: { left: M, right: M },
      styles: { fontSize: 8, cellPadding: 3, textColor: C.text1 },
      headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: C.bg },
      columnStyles: {
        0: { cellWidth: W * 0.35 },
        1: { cellWidth: W * 0.22, halign: 'right', fontStyle: 'bold' },
        2: { cellWidth: W * 0.13, halign: 'right' },
        3: { cellWidth: W * 0.30, textColor: C.text3, fontSize: 7 },
      },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ── 6. INSIGHTS & ALERTAS ─────────────────────────────────────────────────
  const visibleInsights = mode === 'detailed' ? insights : insights.slice(0, 6);
  if (visibleInsights.length > 0) {
    y = ensurePage(y, 40);
    // Dynamic section number
    let sn = 3;
    if (monthlyData.length >= 2) sn++;
    if (topCategories.length > 0) sn++;
    if (patrimonyByType.filter(t => t.value > 0).length > 0) sn++;
    y = sectionTitle(y, String(sn), 'Insights & Alertas', `${visibleInsights.length} detetados`);

    for (const ins of visibleInsights) y = insightBlock(y, ins);

    const riskCount = visibleInsights.filter(i => i.color === 'risk').length;
    const warnCount = visibleInsights.filter(i => i.color === 'warn').length;
    const goodCount = visibleInsights.filter(i => i.color === 'good').length;
    if (riskCount + warnCount + goodCount > 0) {
      y = ensurePage(y, 10);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.text3);
      const parts = [];
      if (riskCount > 0) parts.push(`${riskCount} alerta${riskCount > 1 ? 's' : ''} crítico${riskCount > 1 ? 's' : ''}`);
      if (warnCount > 0) parts.push(`${warnCount} aviso${warnCount > 1 ? 's' : ''}`);
      if (goodCount > 0) parts.push(`${goodCount} ponto${goodCount > 1 ? 's' : ''} positivo${goodCount > 1 ? 's' : ''}`);
      doc.text(`Resumo: ${parts.join(' · ')}`, M, y);
      y += 6;
    }
    y += 2;
  }

  // ── 7. ANÁLISE AI ─────────────────────────────────────────────────────────
  if (aiInsights) {
    y = ensurePage(y, 50);
    y = sectionTitle(y, '✦', 'Análise de Inteligência Artificial', 'gerado pelo Claude');

    if (aiInsights.summary) {
      doc.setFillColor(...C.primary);
      doc.roundedRect(M, y, W, 11, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C.white);
      const sl = doc.splitTextToSize(aiInsights.summary, W - 8);
      doc.text(sl, M + 4, y + 7);
      y += 15;
    }

    if (aiInsights.narrative) {
      y = ensurePage(y, 20);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...C.text1);
      const nl = doc.splitTextToSize(aiInsights.narrative, W);
      doc.text(nl, M, y);
      y += nl.length * 4.2 + 5;
    }

    if (aiInsights.recommendations?.length) {
      y = ensurePage(y, 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...C.text2);
      doc.text('RECOMENDAÇÕES', M, y);
      y += 5;

      aiInsights.recommendations.forEach((rec, i) => {
        y = ensurePage(y, 12);
        const rl = doc.splitTextToSize(rec, W - 8);
        const rh = rl.length * 3.8 + 6;
        doc.setFillColor(...C.bgCard);
        doc.roundedRect(M, y, W, rh, 2, 2, 'F');
        doc.setFillColor(...C.primary);
        doc.circle(M + 4, y + rh / 2, 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...C.white);
        doc.text(String(i + 1), M + 4, y + rh / 2 + 2, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...C.text1);
        doc.text(rl, M + 10, y + 5);
        y += rh + 3;
      });
      y += 2;
    }

    if (aiInsights.outlook) {
      y = ensurePage(y, 14);
      doc.setFillColor(...C.bgCard);
      doc.setDrawColor(...C.border);
      doc.roundedRect(M, y, W, 12, 2, 2, 'FD');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...C.text2);
      const ol = doc.splitTextToSize(`⟶  Próximo mês: ${aiInsights.outlook}`, W - 8);
      doc.text(ol, M + 4, y + 5);
      y += 16;
    }
  }

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(M, PAGE_H - 10, PAGE_W - M, PAGE_H - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.text3);
    doc.text(`${appName} · ${period}`, M, PAGE_H - 6);
    doc.text(`${i} / ${total}`, PAGE_W - M, PAGE_H - 6, { align: 'right' });
  }

  const filename = `relatorio-${period.toLowerCase().replace(/[\s/]+/g, '-')}.pdf`;
  doc.save(filename);
}
