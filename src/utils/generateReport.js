/**
 * generateReport.js — Premium PDF export.
 * Requires: npm install jspdf jspdf-autotable
 *
 * Design: white background, indigo accent, clean cards, no alpha fills.
 */
import { jsPDF }  from 'jspdf';
import autoTable  from 'jspdf-autotable';

// ── Palette — all RGB, NO alpha (jsPDF doesn't support it) ───────────────────
const C = {
  // Backgrounds
  white:      [255, 255, 255],
  pageBg:     [250, 250, 252],   // near-white page
  cardBg:     [245, 247, 250],   // card surface
  cardBorder: [226, 232, 240],   // slate-200
  divider:    [241, 245, 249],   // slate-100

  // Brand
  brand:      [79,  70,  229],   // indigo-600
  brandLight: [224, 231, 255],   // indigo-100 — tint bg
  brandDark:  [49,  46,  129],   // indigo-900 — header text

  // Semantic
  income:     [22,  163,  74],   // green-600
  incomeLight:[220, 252, 231],   // green-100
  expense:    [220,  38,  38],   // red-600
  expenseLight:[254, 226, 226],  // red-100
  warning:    [180, 130,   0],   // amber-600 (darker for legibility)
  warningLight:[254, 243, 199],  // amber-100
  neutral:    [100, 116, 139],   // slate-500
  neutralLight:[241, 245, 249],  // slate-100

  // Text
  text1:      [15,  23,  42],    // slate-950
  text2:      [51,  65,  85],    // slate-700
  text3:      [100, 116, 139],   // slate-500
  textMuted:  [148, 163, 184],   // slate-400
};

// Category palette — 8 distinct solid colours
const CAT_PALETTE = [
  [79,  70,  229],  // indigo
  [22, 163,  74],   // green
  [220,  38,  38],  // red
  [14, 165, 233],   // sky
  [168,  85, 247],  // purple
  [245, 158,  11],  // amber
  [20, 184, 166],   // teal
  [239,  68, 100],  // rose
];

const fmtPT  = (n, d=2) => (n||0).toLocaleString('pt-PT',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmt0   = (n)      => Math.round(Math.abs(n||0)).toLocaleString('pt-PT');
const fmtPct = (n)      => (n>=0?'+':'') + (n||0).toFixed(1) + '%';
const sign   = (n)      => n>=0 ? '+' : '−';
const scoreCol = (s) =>
  s>=80 ? C.income : s>=60 ? C.warning : s>=40 ? [220,100,0] : C.expense;

const PAGE_W = 210;
const PAGE_H = 297;
const M      = 14;          // margin
const W      = PAGE_W-M*2;  // content width
let _doc;
let _generating = false; // Guard against concurrent calls corrupting _doc

// ── Helpers ───────────────────────────────────────────────────────────────────
function newPage() { _doc.addPage(); return M+2; }
function safe(y, need=24) {
  return (y+need > PAGE_H-M-10) ? newPage() : y;
}


// Filled rounded rect — no alpha
function card(x, y, w, h, bg=C.cardBg, borderCol=C.cardBorder) {
  _doc.setFillColor(...bg);
  _doc.setDrawColor(...borderCol);
  _doc.setLineWidth(0.3);
  _doc.roundedRect(x, y, w, h, 3, 3, 'FD');
}

// Section header: thin brand bar + uppercase label
function section(y, num, title, sub) {
  // Left accent bar
  _doc.setFillColor(...C.brand);
  _doc.rect(M, y, 3, 8, 'F');
  // Title
  _doc.setFont('helvetica','bold');
  _doc.setFontSize(9);
  _doc.setTextColor(...C.text1);
  _doc.text(`${num}.  ${title}`, M+6, y+5.5);
  // Subtitle right
  if (sub) {
    _doc.setFont('helvetica','normal');
    _doc.setFontSize(7);
    _doc.setTextColor(...C.textMuted);
    _doc.text(sub, PAGE_W-M, y+5.5, {align:'right'});
  }
  // Divider below
  _doc.setDrawColor(...C.divider);
  _doc.setLineWidth(0.3);
  _doc.line(M+6, y+9, PAGE_W-M, y+9);
  return y+14;
}

// KPI tile
function kpi(x, y, w, h, label, value, sub, valCol) {
  card(x, y, w, h, C.white, C.cardBorder);
  _doc.setFont('helvetica','normal');
  _doc.setFontSize(6);
  _doc.setTextColor(...C.textMuted);
  _doc.text(label, x+w/2, y+5, {align:'center'});
  _doc.setFont('helvetica','bold');
  _doc.setFontSize(11);
  _doc.setTextColor(...(valCol||C.text1));
  _doc.text(value, x+w/2, y+(sub?h-6:h/2+2), {align:'center'});
  if (sub) {
    _doc.setFont('helvetica','normal');
    _doc.setFontSize(6);
    _doc.setTextColor(...C.textMuted);
    _doc.text(sub, x+w/2, y+h-2, {align:'center'});
  }
}

// Highlight callout (no alpha — uses pre-computed light bg)
function callout(y, icon, head, body, lightBg, borderCol) {
  const lines = _doc.splitTextToSize(body, W-18);
  const h     = 10+lines.length*3.8;
  y = safe(y, h+4);
  card(M, y, W, h, lightBg, borderCol);
  // Left accent stripe
  _doc.setFillColor(...borderCol);
  _doc.rect(M, y, 2.5, h, 'F');
  _doc.setFont('helvetica','bold');
  _doc.setFontSize(8);
  _doc.setTextColor(...C.text1);
  _doc.text(`${icon}  ${head}`, M+6, y+6);
  _doc.setFont('helvetica','normal');
  _doc.setFontSize(7.5);
  _doc.setTextColor(...C.text2);
  _doc.text(lines, M+6, y+10.5);
  return y+h+4;
}

// Insight block
function insightBlock(y, ins) {
  const bg  = ins.color==='risk'  ? C.expenseLight
            : ins.color==='warn'  ? C.warningLight
            : ins.color==='good'  ? C.incomeLight
            : C.neutralLight;
  const col = ins.color==='risk'  ? C.expense
            : ins.color==='warn'  ? C.warning
            : ins.color==='good'  ? C.income
            : C.neutral;
  const icon= ins.color==='risk'  ? '⚠'
            : ins.color==='warn'  ? '!'
            : ins.color==='good'  ? '✓' : '·';

  const bodyParts = [ins.message, ins.explanation].filter(Boolean).join(' — ');
  const lines = _doc.splitTextToSize(bodyParts, W-20);
  const h = 7+lines.length*3.6+1;
  y = safe(y, h+4);

  card(M, y, W, h, bg, col);
  _doc.setFillColor(...col);
  _doc.rect(M, y, 2.5, h, 'F');

  _doc.setFont('helvetica','bold');
  _doc.setFontSize(7.5);
  _doc.setTextColor(...C.text1);
  _doc.text(`${icon}  ${ins.title}`, M+6, y+5.2);

  _doc.setFont('helvetica','normal');
  _doc.setFontSize(7);
  _doc.setTextColor(...C.text2);
  _doc.text(lines, M+6, y+9.2);
  return y+h+3;
}

// ── Monthly bar chart ─────────────────────────────────────────────────────────
function barChart(y, monthly) {
  if (!monthly?.length) return y;
  const chartH  = 52;
  const barArea = chartH-14;
  const maxVal  = Math.max(...monthly.flatMap(m=>[m.income||0,m.expenses||0]),1);
  const n       = monthly.length;
  const gw      = W/n;
  const bw      = Math.min((gw-6)/2, 9);

  // Background card
  card(M, y, W, chartH, C.white, C.cardBorder);

  // Grid lines
  for (let g=1; g<=4; g++) {
    const gy = y+4+barArea-(barArea*g/4);
    _doc.setDrawColor(...C.divider);
    _doc.setLineWidth(0.2);
    _doc.line(M+2, gy, M+W-2, gy);
    _doc.setFont('helvetica','normal');
    _doc.setFontSize(5);
    _doc.setTextColor(...C.textMuted);
    _doc.text(fmt0(maxVal*g/4), M+1, gy+1, {align:'right'});
  }

  // Axis
  _doc.setDrawColor(...C.cardBorder);
  _doc.setLineWidth(0.4);
  _doc.line(M+2, y+4+barArea, M+W-2, y+4+barArea);

  // Bars
  monthly.forEach((m,i) => {
    const cx  = M+i*gw+gw/2;
    const incH= barArea*Math.min((m.income||0)/maxVal,1);
    const expH= barArea*Math.min((m.expenses||0)/maxVal,1);
    const gap = 1.5;

    if (incH>0) {
      _doc.setFillColor(...C.income);
      _doc.roundedRect(cx-bw-gap/2, y+4+barArea-incH, bw, incH, 1, 1, 'F');
    }
    if (expH>0) {
      _doc.setFillColor(...C.expense);
      _doc.roundedRect(cx+gap/2, y+4+barArea-expH, bw, expH, 1, 1, 'F');
    }

    _doc.setFont('helvetica','normal');
    _doc.setFontSize(5.5);
    _doc.setTextColor(...C.textMuted);
    _doc.text(m.label||'', cx, y+4+barArea+4.5, {align:'center'});
  });

  // Legend
  const lx = M+W-38;
  const ly  = y+chartH-4;
  _doc.setFillColor(...C.income);  _doc.rect(lx,    ly-2.5, 5, 3,'F');
  _doc.setFillColor(...C.expense); _doc.rect(lx+18, ly-2.5, 5, 3,'F');
  _doc.setFont('helvetica','normal');
  _doc.setFontSize(6);
  _doc.setTextColor(...C.text3);
  _doc.text('Receitas',  lx+6,    ly);
  _doc.text('Despesas',  lx+24,   ly);

  return y+chartH+5;
}

// ── Category visual bars (replaces donut — more reliable) ─────────────────────
function catBars(y, categories, total) {
  if (!categories?.length || !total) return y;
  const h = categories.length*10+8;
  y = safe(y, h+4);
  card(M, y, W, h, C.white, C.cardBorder);

  categories.forEach((cat, i) => {
    const col    = CAT_PALETTE[i%8];
    const barW   = (W-32)*(cat.pct/100);
    const ry     = y+5+i*10;

    // Colour chip
    _doc.setFillColor(...col);
    _doc.roundedRect(M+3, ry+1, 4, 4, 1, 1, 'F');

    // Name
    _doc.setFont('helvetica','bold');
    _doc.setFontSize(7.5);
    _doc.setTextColor(...C.text1);
    _doc.text(cat.name, M+10, ry+5);

    // Bar track
    _doc.setFillColor(...C.divider);
    _doc.roundedRect(M+70, ry+2, W-90, 3, 1, 1, 'F');
    // Bar fill
    if (barW>0) {
      _doc.setFillColor(...col);
      _doc.roundedRect(M+70, ry+2, (W-90)*(cat.pct/100), 3, 1, 1, 'F');
    }

    // Values
    _doc.setFont('helvetica','normal');
    _doc.setFontSize(7);
    _doc.setTextColor(...C.text3);
    _doc.text(`${fmt0(cat.amount)}€`, PAGE_W-M-16, ry+5, {align:'right'});
    _doc.setFont('helvetica','bold');
    _doc.setTextColor(...col);
    _doc.text(`${cat.pct}%`, PAGE_W-M-2, ry+5, {align:'right'});
  });

  return y+h+5;
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateFinancialReport(opts) {
  const {
    period        = 'Período',
    mode          = 'summary',
    income        = 0,
    expenses      = 0,
    savings       = 0,
    savingsRate   = null,
    expenseTrend  = null,
    topCategories = [],
    monthlyData   = [],
    patrimonyByType = [],
    patrimonyTotal  = 0,
    insights        = [],
    score           = {score:0,label:'—'},
    aiInsights      = null,
    appName         = 'Finanças',
  } = opts;

  if (_generating) {
    console.warn('[generateReport] already in progress — ignoring concurrent call');
    return;
  }
  _generating = true;

  const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  _doc = doc;
  let y = 0;

  // ── PAGE BACKGROUND ────────────────────────────────────────────────────────
  doc.setFillColor(...C.pageBg);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  // ── HEADER ─────────────────────────────────────────────────────────────────
  // Header card — solid white, brand left bar
  doc.setFillColor(...C.white);
  doc.rect(0, 0, PAGE_W, 46, 'F');
  doc.setFillColor(...C.brand);
  doc.rect(0, 0, 5, 46, 'F');
  // Bottom border
  doc.setDrawColor(...C.cardBorder);
  doc.setLineWidth(0.4);
  doc.line(0, 46, PAGE_W, 46);

  // App name
  doc.setFont('helvetica','bold');
  doc.setFontSize(18);
  doc.setTextColor(...C.brand);
  doc.text(appName, M+3, 17);

  // Period label
  doc.setFont('helvetica','bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.text1);
  doc.text(period, M+3, 28);

  // Report type tag
  const tagLabel = mode==='detailed' ? 'RELATÓRIO DETALHADO' : 'RELATÓRIO SINTÉTICO';
  doc.setFont('helvetica','bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.textMuted);
  doc.text(tagLabel, M+3, 36);

  // Date
  const now = new Date().toLocaleDateString('pt-PT',{day:'2-digit',month:'long',year:'numeric'});
  doc.setFont('helvetica','normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.textMuted);
  doc.text(`Gerado em ${now}`, PAGE_W-M, 38, {align:'right'});

  // Score badge (right of header)
  const sc   = score.score||0;
  const sCol = scoreCol(sc);
  // Outer circle
  doc.setDrawColor(...sCol);
  doc.setLineWidth(2);
  doc.circle(PAGE_W-M-16, 23, 16, 'S');
  // Inner white fill
  doc.setFillColor(...C.white);
  doc.circle(PAGE_W-M-16, 23, 13.5, 'F');
  // Score number
  doc.setFont('helvetica','bold');
  doc.setFontSize(16);
  doc.setTextColor(...sCol);
  doc.text(String(sc), PAGE_W-M-16, 25.5, {align:'center'});
  // /100 label
  doc.setFont('helvetica','normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...C.textMuted);
  doc.text('/100', PAGE_W-M-16, 30, {align:'center'});

  y = 54;

  // ── SCORE LABEL ────────────────────────────────────────────────────────────
  doc.setFont('helvetica','normal');
  doc.setFontSize(8);
  doc.setTextColor(...sCol);
  doc.text(score.label||'', M, y);
  y += 8;

  // ── 1. DESTAQUES ───────────────────────────────────────────────────────────
  y = section(y, '1', 'Destaques do Período');

  const dailyExp  = expenses>0 ? expenses/30 : 0;
  const annSav    = savings*12;
  const covMonths = dailyExp>0 && patrimonyTotal>0 ? (patrimonyTotal/expenses).toFixed(1) : null;

  if (savings>=0) {
    const savLine = savingsRate!=null
      ? `Taxa de poupança de ${savingsRate}%. Ao manter este ritmo, em 12 meses acumulas ${fmt0(annSav)}€ adicionais.${expenseTrend!=null&&expenseTrend<=0?' Despesas desceram '+Math.abs(expenseTrend)+'% vs mês anterior.':''}`
      : `Se mantiveres este ritmo, acumulas ${fmt0(annSav)}€ no próximo ano.`;
    y = callout(y,'💰',`Poupaste ${fmt0(savings)}€ este período`,savLine,C.incomeLight,C.income);
  } else {
    y = callout(y,'⚠',`Défice de ${fmt0(Math.abs(savings))}€ este período`,
      `Gastaste ${fmt0(Math.abs(savings))}€ a mais do que recebeste.${expenseTrend!=null?' Despesas variaram '+fmtPct(expenseTrend)+' vs o mês anterior.':''} Um défice recorrente reduz as tuas poupanças.`,
      C.expenseLight,C.expense);
  }

  if (dailyExp>1) {
    const top = topCategories[0];
    y = callout(y,'📊',`Despesa diária média: ${fmtPT(dailyExp)}€/dia`,
      `Num mês de 30 dias equivale a ${fmt0(expenses)}€ em despesas.${top?` Maior categoria: ${top.name} com ${fmt0(top.amount)}€ (${top.pct}%).`:''}${expenseTrend!=null?' Tendência: '+fmtPct(expenseTrend)+'.':''}`,
      C.neutralLight,C.neutral);
  }

  if (patrimonyTotal>1000 && expenses>0 && covMonths) {
    const covN = parseFloat(covMonths);
    const msg  = covN<3 ? 'Especialistas recomendam 3-6 meses de reserva de emergência.' : covN<6 ? 'Estás a caminho da zona segura (meta: 6 meses).' : 'Estás na zona segura de reserva de emergência.';
    y = callout(y,'🏦',`Património cobre ${covMonths} meses de despesas`,
      `${fmt0(patrimonyTotal)}€ de património estimado com ${fmt0(expenses)}€/mês de despesas. ${msg}`,
      C.brandLight,C.brand);
  }
  y+=2;

  // ── 2. RESUMO FINANCEIRO ───────────────────────────────────────────────────
  y = safe(y,55);
  y = section(y,'2','Resumo Financeiro',period);

  // 3 KPI tiles
  const tw3=(W-6)/3;
  kpi(M,          y,tw3,24,'RECEITAS', `+${fmtPT(income)}€`,  null,           C.income);
  kpi(M+tw3+3,    y,tw3,24,'DESPESAS', `−${fmtPT(expenses)}€`,null,           C.expense);
  kpi(M+(tw3+3)*2,y,tw3,24,
    savings>=0?'SALDO':'DÉFICE',
    `${sign(savings)}${fmtPT(Math.abs(savings))}€`,
    expenseTrend!=null ? `${fmtPct(expenseTrend)} vs mês ant.` : null,
    savings>=0?C.income:C.expense);
  y+=28;

  if (savingsRate!=null||expenseTrend!=null) {
    const tw2=(W-3)/2;
    if (savingsRate!=null)
      kpi(M,y,tw2,18,'TAXA DE POUPANÇA',
        `${savingsRate}%`,
        savingsRate>=20?'✓ acima do objetivo':savingsRate>=10?'abaixo de 20%':'⚠ abaixo de 10%',
        savingsRate>=20?C.income:savingsRate>=10?C.warning:C.expense);
    if (expenseTrend!=null)
      kpi(M+tw2+3,y,tw2,18,'DESPESAS vs MÊS ANT.',
        (expenseTrend>=0?'+':'')+expenseTrend+'%',
        expenseTrend<=0?'menos despesas ✓':expenseTrend<=10?'ligeiro aumento':'aumento significativo',
        expenseTrend<=0?C.income:expenseTrend<=10?C.warning:C.expense);
    y+=22;
  }

  // Context note
  if (income>0&&expenses>0) {
    const parts=[];
    if (savingsRate!=null) parts.push(`De cada 100€ recebidos, gastas ${Math.round(expenses/income*100)}€ e guardas ${savingsRate}€`);
    if (dailyExp>0)        parts.push(`despesa diária: ${fmtPT(dailyExp)}€`);
    if (annSav!==0)        parts.push(`projeção anual de poupança: ${sign(savings)}${fmt0(Math.abs(annSav))}€`);
    if (parts.length) {
      _doc.setFont('helvetica','italic'); _doc.setFontSize(7);
      _doc.setTextColor(...C.textMuted);
      _doc.text(parts.join(' · '), M, y);
      y+=7;
    }
  }
  y+=2;

  // ── 3. EVOLUÇÃO MENSAL — detalhado only ────────────────────────────────────
  if (mode==='detailed' && monthlyData.length>=2) {
    y = safe(y,72);
    y = section(y,'3','Evolução dos Últimos Meses',`${monthlyData.length} meses`);
    y = barChart(y, monthlyData);
    y+=2;
  }

  // ── 4. TOP CATEGORIAS ──────────────────────────────────────────────────────
  // summary: top 3; detailed: top 5
  const visibleCats = mode==='detailed' ? topCategories : topCategories.slice(0,3);
  if (visibleCats.length>0) {
    const n4 = (mode==='detailed' && monthlyData.length>=2) ? '4' : '3';
    y = safe(y,60);
    y = section(y,n4,'Top Categorias de Despesa',`total: ${fmt0(expenses)}€`);
    y = catBars(y, visibleCats, expenses);

    // Context line
    if (visibleCats[0]&&income>0) {
      const top=visibleCats[0];
      _doc.setFont('helvetica','italic'); _doc.setFontSize(7);
      _doc.setTextColor(...C.textMuted);
      _doc.text(`${top.name}: ${top.pct}% das despesas · ${Math.round(top.amount/income*100)}% do rendimento · ${fmt0(top.amount*12)}€/ano ao ritmo atual.`, M, y);
      y+=7;
    }
    y+=2;
  }

  // ── 5. PATRIMÓNIO ──────────────────────────────────────────────────────────
  const patItems = patrimonyByType.filter(t=>t.value>0);
  if (patItems.length>0) {
    let nPat=3;
    if (monthlyData.length>=2) nPat++;
    if (topCategories.length>0) nPat++;
    y = safe(y,55);
    y = section(y,String(nPat),'Snapshot de Património','preços armazenados');

    // Total hero
    card(M,y,W,16,C.white,C.brand);
    _doc.setFont('helvetica','normal'); _doc.setFontSize(8);
    _doc.setTextColor(...C.text3);
    _doc.text('TOTAL ESTIMADO', M+4, y+7);
    _doc.setFont('helvetica','bold'); _doc.setFontSize(15);
    _doc.setTextColor(...C.brand);
    _doc.text(`${fmtPT(patrimonyTotal)}€`, PAGE_W-M-4, y+11, {align:'right'});
    if (expenses>0) {
      _doc.setFont('helvetica','normal'); _doc.setFontSize(6.5);
      _doc.setTextColor(...C.textMuted);
      _doc.text(`cobre ${(patrimonyTotal/expenses).toFixed(1)} meses de despesas`, PAGE_W-M-4, y+14.5, {align:'right'});
    }
    y+=20;

    if (mode==='detailed') {
      const patRows = patItems.sort((a,b)=>b.value-a.value).map(t=>{
        const pct = patrimonyTotal>0 ? Math.round(t.value/patrimonyTotal*100) : 0;
        const eq  = savings>0 ? `${fmt0(t.value/Math.max(savings,1))} meses de poupança` : '—';
        return [t.label||t.key, `${fmtPT(t.value)}€`, `${pct}%`, eq];
      });
      autoTable(doc,{
        startY:y, head:[['Ativo','Valor','% Total','Equivalência']], body:patRows,
        margin:{left:M,right:M},
        styles:{fontSize:8,cellPadding:3,textColor:C.text1,fillColor:C.white},
        headStyles:{fillColor:C.brand,textColor:C.white,fontStyle:'bold',fontSize:7.5},
        alternateRowStyles:{fillColor:C.cardBg},
        columnStyles:{
          0:{cellWidth:W*0.35},
          1:{cellWidth:W*0.22,halign:'right',fontStyle:'bold'},
          2:{cellWidth:W*0.13,halign:'right'},
          3:{cellWidth:W*0.30,textColor:[...C.textMuted],fontSize:7},
        },
      });
      y=doc.lastAutoTable.finalY+6;
    } else {
      y+=4; // summary: just the total hero already shown above
    }
  }

  // ── 6. INSIGHTS ────────────────────────────────────────────────────────────
  const vis = mode==='detailed' ? insights : insights.slice(0,4);
  if (vis.length>0) {
    let nIns=3;
    if (monthlyData.length>=2) nIns++;
    if (topCategories.length>0) nIns++;
    if (patItems.length>0) nIns++;
    y = safe(y,40);
    y = section(y,String(nIns),'Insights & Alertas',`${vis.length} detetados`);
    for (const ins of vis) y=insightBlock(y,ins);
    // Summary
    const rk=vis.filter(i=>i.color==='risk').length;
    const wk=vis.filter(i=>i.color==='warn').length;
    const gk=vis.filter(i=>i.color==='good').length;
    if (rk+wk+gk>0) {
      y=safe(y,8);
      const parts=[];
      if(rk) parts.push(`${rk} alerta${rk>1?'s':''} crítico${rk>1?'s':''}`);
      if(wk) parts.push(`${wk} aviso${wk>1?'s':''}`);
      if(gk) parts.push(`${gk} ponto${gk>1?'s':''} positivo${gk>1?'s':''}`);
      _doc.setFont('helvetica','italic'); _doc.setFontSize(7);
      _doc.setTextColor(...C.textMuted);
      _doc.text('Resumo: '+parts.join(' · '), M, y);
      y+=6;
    }
    y+=2;
  }

  // ── 7. ANÁLISE AI ──────────────────────────────────────────────────────────
  if (aiInsights) {
    y = safe(y,50);
    y = section(y,'✦','Análise de Inteligência Artificial','gerado pelo Claude');

    // ── Summary banner ─────────────────────────────────────────────────────
    if (aiInsights.summary) {
      card(M,y,W,13,C.brand,C.brand);
      _doc.setFont('helvetica','bold'); _doc.setFontSize(9);
      _doc.setTextColor(...C.white);
      const sl=_doc.splitTextToSize(aiInsights.summary,W-10);
      _doc.text(sl, M+5, y+8.5);
      y+=17;
    }

    // ── Fiabilidade dos dados (avisos de confiança) ────────────────────────
    if (aiInsights.confidence?.notes?.length) {
      const cf = aiInsights.confidence;
      const isWarn = cf.level === 'low' || cf.level === 'medium';
      const cfLines = cf.notes.flatMap(n => _doc.splitTextToSize(`• ${n}`, W-10));
      const cfH = cfLines.length*3.8+11;
      y=safe(y,cfH+4);
      card(M,y,W,cfH, isWarn ? C.warningLight : C.neutralLight, isWarn ? C.warning : C.neutral);
      _doc.setFillColor(...(isWarn ? C.warning : C.neutral)); _doc.rect(M,y,2.5,cfH,'F');
      _doc.setFont('helvetica','bold'); _doc.setFontSize(7);
      _doc.setTextColor(...(isWarn ? C.warning : C.text3));
      _doc.text('FIABILIDADE DOS DADOS', M+6, y+5.5);
      _doc.setFont('helvetica','normal'); _doc.setFontSize(7.5);
      _doc.setTextColor(...C.text2);
      let cfy=y+9.5;
      cf.notes.forEach(n => {
        const nl=_doc.splitTextToSize(`• ${n}`, W-10);
        _doc.text(nl, M+6, cfy);
        cfy+=nl.length*3.8+1;
      });
      y+=cfH+5;
    }

    // ── Narrative ──────────────────────────────────────────────────────────
    if (aiInsights.narrative) {
      y=safe(y,16);
      _doc.setFont('helvetica','normal'); _doc.setFontSize(8.5);
      _doc.setTextColor(...C.text1);
      const nl=_doc.splitTextToSize(aiInsights.narrative,W);
      _doc.text(nl,M,y);
      y+=nl.length*4.2+6;
    }

    // ── Deep analysis ──────────────────────────────────────────────────────
    if (aiInsights.detailedAnalysis) {
      y=safe(y,20);
      const dal=_doc.splitTextToSize(aiInsights.detailedAnalysis, W-8);
      const dah=dal.length*3.8+10;
      card(M,y,W,dah,C.neutralLight,C.cardBorder);
      _doc.setFillColor(...C.neutral);
      _doc.rect(M,y,2.5,dah,'F');
      _doc.setFont('helvetica','bold'); _doc.setFontSize(7);
      _doc.setTextColor(...C.text3);
      _doc.text('ANÁLISE DETALHADA', M+6, y+5.5);
      _doc.setFont('helvetica','normal'); _doc.setFontSize(8);
      _doc.setTextColor(...C.text2);
      _doc.text(dal, M+6, y+9.5);
      y+=dah+5;
    }

    // ── Strengths & Concerns side by side ──────────────────────────────────
    const hasStr = aiInsights.strengths?.length;
    const hasCon = aiInsights.concerns?.length;
    if (hasStr || hasCon) {
      const colW = (W-4)/2;
      // Left: Strengths
      if (hasStr) {
        const strLines = aiInsights.strengths.flatMap(s => _doc.splitTextToSize(`✓  ${s}`, colW-8));
        const strH = strLines.length*3.6+12;
        y=safe(y, strH+4);
        card(M, y, colW, strH, C.incomeLight, C.income);
        _doc.setFillColor(...C.income); _doc.rect(M,y,2.5,strH,'F');
        _doc.setFont('helvetica','bold'); _doc.setFontSize(7);
        _doc.setTextColor(...C.income);
        _doc.text('PONTOS POSITIVOS', M+6, y+5.5);
        _doc.setFont('helvetica','normal'); _doc.setFontSize(7.5);
        _doc.setTextColor(...C.text2);
        let sy=y+9.5;
        aiInsights.strengths.forEach(s => {
          const sl2=_doc.splitTextToSize(`✓  ${s}`, colW-8);
          _doc.text(sl2,M+6,sy);
          sy+=sl2.length*3.6+1;
        });
        // Right: Concerns
        if (hasCon) {
          const conLines = aiInsights.concerns.flatMap(c => _doc.splitTextToSize(`⚠  ${c}`, colW-8));
          const conH = Math.max(strH, conLines.length*3.6+12);
          card(M+colW+4, y, colW, conH, C.warningLight, C.warning);
          _doc.setFillColor(...C.warning); _doc.rect(M+colW+4,y,2.5,conH,'F');
          _doc.setFont('helvetica','bold'); _doc.setFontSize(7);
          _doc.setTextColor(...C.warning);
          _doc.text('A MONITORIZAR', M+colW+10, y+5.5);
          _doc.setFont('helvetica','normal'); _doc.setFontSize(7.5);
          _doc.setTextColor(...C.text2);
          let cy=y+9.5;
          aiInsights.concerns.forEach(c => {
            const cl2=_doc.splitTextToSize(`⚠  ${c}`, colW-8);
            _doc.text(cl2,M+colW+10,cy);
            cy+=cl2.length*3.6+1;
          });
          y+=Math.max(strH, conH)+5;
        } else {
          y+=strH+5;
        }
      } else if (hasCon) {
        // Only concerns, full width
        const conLines = aiInsights.concerns.flatMap(c => _doc.splitTextToSize(`⚠  ${c}`, W-8));
        const conH = conLines.length*3.6+12;
        y=safe(y,conH+4);
        card(M,y,W,conH,C.warningLight,C.warning);
        _doc.setFillColor(...C.warning); _doc.rect(M,y,2.5,conH,'F');
        _doc.setFont('helvetica','bold'); _doc.setFontSize(7);
        _doc.setTextColor(...C.warning);
        _doc.text('A MONITORIZAR', M+6, y+5.5);
        _doc.setFont('helvetica','normal'); _doc.setFontSize(7.5);
        _doc.setTextColor(...C.text2);
        _doc.text(conLines,M+6,y+9.5);
        y+=conH+5;
      }
    }

    // ── Category insights ──────────────────────────────────────────────────
    if (aiInsights.categoryInsights?.length) {
      y=safe(y,14);
      _doc.setFont('helvetica','bold'); _doc.setFontSize(7.5);
      _doc.setTextColor(...C.text2);
      _doc.text('ANÁLISE POR CATEGORIA', M, y);
      y+=5;
      aiInsights.categoryInsights.forEach((ci,i) => {
        y=safe(y,12);
        const col=CAT_PALETTE[i%8];
        const txt=_doc.splitTextToSize(ci.insight, W-18);
        const h=txt.length*3.6+9;
        card(M,y,W,h,C.white,C.cardBorder);
        _doc.setFillColor(...col);
        _doc.roundedRect(M+3,y+2.5,4,4,1,1,'F');
        _doc.setFont('helvetica','bold'); _doc.setFontSize(7.5);
        _doc.setTextColor(...C.text1);
        _doc.text(ci.category||'', M+10, y+5.5);
        _doc.setFont('helvetica','normal'); _doc.setFontSize(7.5);
        _doc.setTextColor(...C.text2);
        _doc.text(txt, M+10, y+9);
        y+=h+3;
      });
      y+=2;
    }

    // ── Recommendations ────────────────────────────────────────────────────
    if (aiInsights.recommendations?.length) {
      y=safe(y,14);
      _doc.setFont('helvetica','bold'); _doc.setFontSize(8);
      _doc.setTextColor(...C.text2);
      _doc.text('RECOMENDAÇÕES',M,y);
      y+=5;
      aiInsights.recommendations.forEach((rec,i)=>{
        y=safe(y,12);
        const rl=_doc.splitTextToSize(rec,W-12);
        const rh=rl.length*3.8+8;
        card(M,y,W,rh,C.cardBg,C.cardBorder);
        _doc.setFillColor(...C.brand);
        _doc.circle(M+5,y+rh/2,3.5,'F');
        _doc.setFont('helvetica','bold'); _doc.setFontSize(7);
        _doc.setTextColor(...C.white);
        _doc.text(String(i+1),M+5,y+rh/2+2,{align:'center'});
        _doc.setFont('helvetica','normal'); _doc.setFontSize(8);
        _doc.setTextColor(...C.text1);
        _doc.text(rl,M+12,y+5.5);
        y+=rh+3;
      });
      y+=2;
    }

    // ── Projections ────────────────────────────────────────────────────────
    if (aiInsights.projections) {
      y=safe(y,16);
      const pl=_doc.splitTextToSize(`📈  ${aiInsights.projections}`,W-8);
      const ph=pl.length*3.8+10;
      card(M,y,W,ph,C.brandLight,C.brand);
      _doc.setFillColor(...C.brand); _doc.rect(M,y,2.5,ph,'F');
      _doc.setFont('helvetica','bold'); _doc.setFontSize(7);
      _doc.setTextColor(...C.brand);
      _doc.text('PROJEÇÃO', M+6, y+5.5);
      _doc.setFont('helvetica','italic'); _doc.setFontSize(8);
      _doc.setTextColor(...C.text1);
      _doc.text(pl,M+6,y+9.5);
      y+=ph+5;
    }

    // ── Outlook ────────────────────────────────────────────────────────────
    if (aiInsights.outlook) {
      y=safe(y,14);
      card(M,y,W,12,C.brand,C.brand);
      _doc.setFont('helvetica','italic'); _doc.setFontSize(8);
      _doc.setTextColor(...C.white);
      const ol=_doc.splitTextToSize(`Próximo mês: ${aiInsights.outlook}`,W-8);
      _doc.text(ol,M+4,y+7.5);
      y+=16;
    }
  }

  // ── FOOTER every page ──────────────────────────────────────────────────────
  const total=doc.getNumberOfPages();
  for (let i=1;i<=total;i++) {
    doc.setPage(i);
    // Footer bar
    doc.setFillColor(...C.white);
    doc.rect(0,PAGE_H-12,PAGE_W,12,'F');
    doc.setDrawColor(...C.cardBorder);
    doc.setLineWidth(0.3);
    doc.line(0,PAGE_H-12,PAGE_W,PAGE_H-12);
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5);
    doc.setTextColor(...C.textMuted);
    doc.text(`${appName} · ${period}`,M,PAGE_H-5);
    doc.text(`${i} / ${total}`,PAGE_W-M,PAGE_H-5,{align:'right'});
    // Brand dot
    doc.setFillColor(...C.brand);
    doc.circle(PAGE_W/2,PAGE_H-6,1,'F');
  }

  const fname=`relatorio-${period.toLowerCase().replace(/[\s/]+/g,'-')}.pdf`;
  doc.save(fname);
  _generating = false;
}
