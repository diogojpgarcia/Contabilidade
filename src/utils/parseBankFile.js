// ─── Universal Bank Statement Parser ────────────────────────────────────────
// Supports any European bank CSV / PDF format.
// Never throws; always returns the best possible result.
// ─────────────────────────────────────────────────────────────────────────────
import { parsePDF }  from './parseBankPdf';
import { parseXLSX } from './parseBankXlsx';


// ── Column keyword scoring tables ────────────────────────────────────────────
// Exportadas + helpers (norm, detectColumns) porque parseBankXlsx.js e
// parseBankPdf.js (split deste ficheiro) dependem destes símbolos.
export const SCORE_DATE = [
  'date','data','datum','fecha','valuta','buchungstag','booking','wertstellung',
  'movimento','data mov','data valor','transaction date','posting date','value date',
  'boekdatum','rekeningdatum','handelsdatum',
];
export const SCORE_DESC = [
  'description','descricao','historico','movimento','details','detail',
  'omschrijving','verwendungszweck','memo','narration','reference','referencia',
  'text','label','transaction','hist','descr','bezeichnung','betreff','subject',
  'particulars','remark','remarks','note','notes','transaction details',
  'payment details','beneficiary','creditor name','naam','tegenrekening naam',
  'comunicacao','payee','payer','beneficiario','ordenante','contraparte',
  'merchant','counterparty','nome','entidade',
];
export const SCORE_AMT = [
  'amount','valor','betrag','bedrag','importe','importancia','montant','montante',
  'quantia','total','net amount','transaction amount','movimento',
];
// Saldo / running balance — detetada para ser EXCLUÍDA da coluna de montante.
export const SCORE_BALANCE = [
  'saldo','balance','saldo contabilistico','saldo disponivel','saldo apos movimento',
  'saldo apos','saldo final','saldo atual','running balance','saldo escritural',
];
export const SCORE_DEBIT = [
  'debit','debito','debito','db','deb','af','uitgaven','ausgabe',
  'withdrawal','charge','debet','kosten','saidas','saida',
];
export const SCORE_CREDIT = [
  'credit','credito','credito','cr','cred','bij','inkomsten','einnahme',
  'deposit','payment','entradas','entrada','receita',
];

// ── Encoding-aware buffer decoder ─────────────────────────────────────────────
// Portuguese bank CSVs (Millennium BCP, CGD, etc.) are often Windows-1252.
// TextDecoder defaults to UTF-8; 0xE9 (é) decoded as UTF-8 → U+FFFD garbage,
// which breaks column name matching for Débito/Crédito.
function decodeBuffer(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  // BOM detection
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF)
    return new TextDecoder('utf-8').decode(bytes);           // UTF-8 BOM
  if (bytes[0] === 0xFF && bytes[1] === 0xFE)
    return new TextDecoder('utf-16le').decode(bytes);        // UTF-16 LE BOM
  if (bytes[0] === 0xFE && bytes[1] === 0xFF)
    return new TextDecoder('utf-16be').decode(bytes);        // UTF-16 BE BOM

  // Try UTF-8 — if too many replacement chars, assume Windows-1252
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const replacements = (utf8.match(/�/g) || []).length;
  if (replacements > 0) {
    return new TextDecoder('windows-1252').decode(bytes);
  }

  return utf8;
}

// ── Normalisation helpers ─────────────────────────────────────────────────────
export function norm(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // strip combining diacritics
    .replace(/�/g, '')           // strip UTF-8 replacement chars
    .replace(/[_\-\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreHeader(header, keywords) {
  const h = norm(header);
  let best = 0;
  for (const kw of keywords) {
    if (h === kw)                                            { best = Math.max(best, 10); break; }
    if (h.startsWith(kw + ' ') || h.endsWith(' ' + kw))    { best = Math.max(best, 7); }
    if (h.includes(kw))                                      { best = Math.max(best, 5); }
    if (kw.includes(h) && h.length >= 3)                     { best = Math.max(best, 3); }
  }
  return best;
}

// ── Delimiter detection ───────────────────────────────────────────────────────
function detectDelimiter(sample) {
  const candidates = [';', ',', '\t', '|'];
  const lines = sample.split(/\r?\n/).filter(l => l.trim()).slice(0, 5);
  let bestDelim = ',';
  let bestConsistency = -1;
  for (const d of candidates) {
    const lineCounts = lines.map(l => {
      let n = 0, iq = false;
      for (const c of l) {
        if (c === '"') { iq = !iq; continue; }
        if (!iq && c === d) n++;
      }
      return n;
    }).filter(n => n > 0);
    if (lineCounts.length === 0) continue;
    const avg = lineCounts.reduce((a, b) => a + b, 0) / lineCounts.length;
    const variance = lineCounts.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / lineCounts.length;
    const consistency = avg - variance * 0.1;
    if (consistency > bestConsistency) { bestConsistency = consistency; bestDelim = d; }
  }
  return bestDelim;
}

// ── CSV tokeniser ─────────────────────────────────────────────────────────────
function tokenizeCSV(text, delimiter) {
  const rows = [];
  let row = [], cell = '', inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') { cell += '"'; i++; }
      else inQuote = !inQuote;
    } else if (!inQuote && ch === delimiter) {
      row.push(cell.trim()); cell = '';
    } else if (!inQuote && (ch === '\n' || (ch === '\r' && text[i + 1] === '\n'))) {
      if (ch === '\r') i++;
      row.push(cell.trim()); cell = '';
      if (row.some(c => c !== '')) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell.trim());
    if (row.some(c => c !== '')) rows.push(row);
  }
  return rows;
}

// ── Date parsing ─────────────────────────────────────────────────────────────
export function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m;
  if ((m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)))
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})$/)))
    return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/))) {
    const yr = parseInt(m[3]) < 50 ? '20' + m[3] : '19' + m[3];
    return `${yr}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime()) && s.length >= 8) return d.toISOString().slice(0, 10);
  return null;
}

function looksLikeDate(s) { return parseDate(s) !== null; }

// ── Amount parsing ────────────────────────────────────────────────────────────
export function parseAmount(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();

  // Step 1 — detect sign BEFORE any cleaning
  const isNegative =
    /^\s*-/.test(s)           ||  // "-12.50"  "- 12,50"
    /[-]\s*$/.test(s)         ||  // "12.50-"
    /^\s*\(.*\)\s*$/.test(s)  ||  // "(12.50)"
    /[€$£¥]\s*-/.test(s)     ||  // "€ -12,50"
    /-\s*[€$£¥]/.test(s);        // "-€12,50"

  // Step 2 — strip symbols, parens, spaces, sign chars
  let clean = s
    .replace(/[€$£¥]/g, '')
    .replace(/[()]/g, '')
    .replace(/[\s ]/g, '')
    .replace(/[+-]/g, '')
    .trim();

  if (!clean) return null;

  // Step 3 — normalise decimal separator
  const lastComma = clean.lastIndexOf(',');
  const lastDot   = clean.lastIndexOf('.');

  if (lastComma > lastDot) {
    clean = clean.replace(/\./g, '').replace(',', '.');  // European: 1.234,56
  } else if (lastDot > lastComma) {
    clean = clean.replace(/,/g, '');                      // Anglo: 1,234.56
  } else {
    clean = clean.replace(/[,.]/g, '');                   // Integer
  }

  // Step 4 — parse; n is always positive here
  const n = parseFloat(clean);
  if (isNaN(n)) return null;

  // Step 5 — apply sign; NO Math.abs — caller applies Math.abs before DB insert
  return isNegative ? -n : n;
}

function looksLikeAmount(s) { return parseAmount(s) !== null; }

// ── Description cleaning ─────────────────────────────────────────────────────
export function cleanDescription(raw, fallbacks) {
  const clean = v => v && String(v).replace(/\s+/g, ' ').trim();
  const c = clean(raw);
  if (c) return c;
  if (Array.isArray(fallbacks)) {
    for (const v of fallbacks) {
      const fc = clean(v);
      if (fc && !looksLikeDate(fc) && !looksLikeAmount(fc)) return fc;
    }
  }
  return 'unknown transaction';
}

// ── Dedup key ─────────────────────────────────────────────────────────────────
function dedupKey(r) {
  return `${r.date}|${r.amount}|${(r.description || '').slice(0, 30)}`;
}

// ── Column direction tokens (D/C) ─────────────────────────────────────────────
const DIR_DEBIT  = new Set(['d','db','deb','debito','dr','debit','saida','saidas','out','withdrawal','charge']);
const DIR_CREDIT = new Set(['c','cr','cred','credito','credit','entrada','entradas','in','deposit','payment','abono']);

// ── Per-column data statistics ────────────────────────────────────────────────
// Calcula, a partir de uma amostra de valores, que fração parseia como data,
// como número, com sinal +/-, como token de direção (D/C), e o tamanho médio
// do texto livre. É a base da deteção data-driven.
function colStats(values) {
  let nonEmpty = 0, dateHits = 0, numHits = 0, signedHits = 0, dirHits = 0, textLen = 0, textN = 0;
  for (const raw of values) {
    const v = (raw ?? '').toString().trim();
    if (!v) continue;
    nonEmpty++;
    const isDate = !!parseDate(v);
    const isNum  = !isDate && /\d/.test(v) && parseAmount(v) !== null;
    if (isDate) dateHits++;
    if (isNum) {
      numHits++;
      if (/^\s*[+\-(]/.test(v) || /\d\s*-\s*$/.test(v)) signedHits++;
    }
    if (!isDate && !isNum) {
      textLen += v.length; textN++;
      const nv = norm(v);
      if (nv.length <= 12 && (DIR_DEBIT.has(nv) || DIR_CREDIT.has(nv))) dirHits++;
    }
  }
  const den = nonEmpty || 1;
  return {
    nonEmpty,
    dateRate:   dateHits / den,
    numRate:    numHits / den,
    signedRate: signedHits / den,
    dirRate:    dirHits / den,
    avgText:    textN ? textLen / textN : 0,
  };
}

// ── Column detection (data-driven) ────────────────────────────────────────────
// Infere o papel de cada coluna a partir dos DADOS (taxa de datas, de números,
// de sinais +/-, de texto), usando os nomes só como desempate. Generaliza para
// qualquer banco, mesmo com cabeçalhos invulgares ou colisões de keywords.
export function detectColumns(headers, dataRows = []) {
  const sample = dataRows.slice(0, 60);
  const hasData = sample.length > 0;
  const info = headers.map((h, i) => ({
    h, i,
    st: colStats(sample.map(r => (Array.isArray(r) ? r[i] : undefined))),
    nameDate:   scoreHeader(h, SCORE_DATE),
    nameDesc:   scoreHeader(h, SCORE_DESC),
    nameAmt:    scoreHeader(h, SCORE_AMT),
    nameDebit:  scoreHeader(h, SCORE_DEBIT),
    nameCredit: scoreHeader(h, SCORE_CREDIT),
    nameBal:    scoreHeader(h, SCORE_BALANCE),
  }));
  const cols = {
    date: null, dateScore: 0, desc: null, descScore: 0, amt: null, amtScore: 0,
    debit: null, debitScore: 0, credit: null, creditScore: 0, direction: null, balance: null,
  };
  const used = new Set();
  const avail = () => info.filter(c => !used.has(c.i));

  // 1) DATE — coluna que mais parseia como data (ou, sem dados, pelo nome)
  {
    let best = null, bestSc = 0;
    for (const c of avail()) {
      const dataSig = c.st.dateRate >= 0.6 ? 100 + c.st.dateRate * 10 : 0;
      const sc = dataSig + c.nameDate;
      const eligible = hasData ? c.st.dateRate >= 0.6 : c.nameDate > 0;
      if (eligible && sc > bestSc) { bestSc = sc; best = c; }
    }
    if (best) { cols.date = best.h; cols.dateScore = Math.max(best.nameDate, best.st.dateRate >= 0.6 ? 10 : 0); used.add(best.i); }
  }

  // 2) BALANCE — numérica com nome 'saldo' (excluída de montante/descrição)
  {
    let best = null, bestSc = 0;
    for (const c of avail()) {
      if (hasData && c.st.numRate < 0.5) continue;
      if (c.nameBal > bestSc) { bestSc = c.nameBal; best = c; }
    }
    if (best && bestSc >= 5) { cols.balance = best.h; used.add(best.i); }
  }

  // 3) DEBIT/CREDIT — par de colunas numéricas com nomes débito/crédito
  {
    let dCol = null, dSc = 0, cCol = null, cSc = 0;
    for (const c of avail()) {
      if (hasData && c.st.numRate < 0.15) continue;
      if (c.nameDebit  > dSc) { dSc = c.nameDebit;  dCol = c; }
      if (c.nameCredit > cSc) { cSc = c.nameCredit; cCol = c; }
    }
    if (dCol && cCol && dCol.i !== cCol.i && dSc >= 5 && cSc >= 5) {
      cols.debit  = dCol.h; cols.debitScore  = dSc; used.add(dCol.i);
      cols.credit = cCol.h; cols.creditScore = cSc; used.add(cCol.i);
    }
  }

  // 4) AMOUNT (coluna única) — só se não houver par débito/crédito.
  //    Prefere a coluna NUMÉRICA com mais sinais +/-, depois pelo nome.
  if (!cols.debit && !cols.credit) {
    let best = null, bestSc = -1;
    for (const c of avail()) {
      if (hasData && c.st.numRate < 0.6) continue;
      if (!hasData && c.nameAmt === 0) continue;
      const sc = c.st.signedRate * 100 + c.nameAmt * 3 + c.st.numRate;
      if (sc > bestSc) { bestSc = sc; best = c; }
    }
    if (best) { cols.amt = best.h; cols.amtScore = best.st.signedRate > 0.3 ? 20 : Math.max(5, best.nameAmt); used.add(best.i); }
  }

  // 5) DIRECTION — coluna D/C (valores curtos do conjunto débito/crédito)
  for (const c of avail()) {
    if (c.st.dirRate >= 0.6 && c.st.nonEmpty >= 1) { cols.direction = c.h; used.add(c.i); break; }
  }

  // 6) DESCRIPTION — entre as restantes, a de maior conteúdo de texto (+ nome)
  {
    let best = null, bestSc = -1;
    for (const c of avail()) {
      const sc = c.st.avgText * 2 + c.nameDesc * 3;
      if (sc > bestSc) { bestSc = sc; best = c; }
    }
    if (best) { cols.desc = best.h; cols.descScore = Math.max(best.nameDesc, best.st.avgText > 3 ? 5 : 0); }
  }

  // Guarda: montante e data nunca podem ser a mesma coluna
  if (cols.amt && cols.amt === cols.date) { cols.amt = null; cols.amtScore = 0; }
  return cols;
}

// ── Header row finder ─────────────────────────────────────────────────────────
function findHeaderRow(rows) {
  const allKeys = [...SCORE_DATE, ...SCORE_DESC, ...SCORE_AMT, ...SCORE_DEBIT, ...SCORE_CREDIT];
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    const rowNorm = rows[i].map(norm);
    const hits = rowNorm.filter(h => allKeys.some(k => h === k || h.includes(k)));
    if (hits.length >= 2) return i;
  }
  return 0;
}

// ── Data-driven: find column with explicitly signed values ────────────────────
// Scans the first 30 data rows. Returns the header whose cells most often
// contain an explicit +/- sign. This catches cases where the column name is
// unrecognised ("Montante", "Valor Mov.", "Importe") but the data itself has
// signed numbers like "-4,00" or "+1.500,00".
export function findSignedAmountColumn(headers, dataRows) {
  const counts = {};
  headers.forEach(h => { counts[h] = 0; });

  for (const row of dataRows.slice(0, 30)) {
    headers.forEach((h, i) => {
      const v = (row[i] || '').trim();
      if (!v) return;
      // Explicit sign: starts with +/-, ends with -, or wrapped in parens
      const hasSig = /^\s*[+\-]\s*[\d]/.test(v)
                  || /[\d]\s*[-]\s*$/.test(v)
                  || /^\s*\([\d]/.test(v);
      if (hasSig && parseAmount(v) !== null) counts[h]++;
    });
  }

  const best = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!best.length) return null;
  return best[0][0];
}

// ── Data-driven: find D/C direction column (legacy helper, mantido p/ compat) ──
// Some banks export unsigned amounts with a separate column that says "D"/"C"
// or "Débito"/"Crédito". A deteção principal está agora em detectColumns
// (cols.direction); este helper fica como utilitário.
function findDirectionColumn(headers, dataRows) {
  for (const h of headers) {
    let matches = 0, total = 0;
    for (const row of dataRows.slice(0, 30)) {
      const obj = {};
      headers.forEach((hh, i) => { obj[hh] = (row[i] || '').trim(); });
      const v = norm(obj[h] || '');
      if (!v || v.length > 12) continue;
      total++;
      if (DIR_DEBIT.has(v) || DIR_CREDIT.has(v)) matches++;
    }
    if (total >= 3 && matches / total >= 0.6) {
      return h;
    }
  }
  return null;
}

// ── Row-level amount resolution ───────────────────────────────────────────────
// Debit col value  → negative (expense)
// Credit col value → positive (income)
// Single signed amt col → pass through as-is
function resolveAmount(obj, cols) {
  const hasDebitCredit = (cols.debitScore >= 5 || cols.creditScore >= 5);

  if (hasDebitCredit) {
    const rawDebit  = cols.debit  ? obj[cols.debit]  : '';
    const rawCredit = cols.credit ? obj[cols.credit] : '';

    const debitVal  = rawDebit  ? parseAmount(rawDebit)  : null;
    const creditVal = rawCredit ? parseAmount(rawCredit) : null;
    const debitAbs  = debitVal  !== null ? Math.abs(debitVal)  : 0;
    const creditAbs = creditVal !== null ? Math.abs(creditVal) : 0;

    if (creditAbs > 0 && debitAbs === 0) return  creditAbs;   // income
    if (debitAbs  > 0 && creditAbs === 0) return -debitAbs;   // expense
    if (creditAbs > 0 && debitAbs  > 0)  return  creditAbs - debitAbs; // net
  }

  // Single signed amount column
  if (cols.amt && obj[cols.amt] !== undefined && obj[cols.amt] !== '') {
    const raw = obj[cols.amt];
    const a   = parseAmount(raw);
    if (a !== null) return a;
  }

  // Low-confidence debit/credit fallback
  if (cols.debit || cols.credit) {
    const debitVal  = cols.debit  ? parseAmount(obj[cols.debit])  : null;
    const creditVal = cols.credit ? parseAmount(obj[cols.credit]) : null;
    const debitAbs  = debitVal  !== null ? Math.abs(debitVal)  : 0;
    const creditAbs = creditVal !== null ? Math.abs(creditVal) : 0;
    if (creditAbs > 0 && debitAbs === 0) return  creditAbs;
    if (debitAbs  > 0 && creditAbs === 0) return -debitAbs;
    if (creditAbs > 0 && debitAbs  > 0)  return  creditAbs - debitAbs;
  }

  return null;
}

// Resolve o montante COM sinal final, aplicando a coluna de direção (D/C) quando
// existe e o montante veio sem sinal. Fonte única usada por CSV e XLSX.
export function resolveSignedAmount(obj, cols) {
  let amount = resolveAmount(obj, cols);
  if (amount !== null && cols.direction && obj[cols.direction]) {
    const dir = norm(obj[cols.direction]);
    if (DIR_DEBIT.has(dir)  && amount > 0) amount = -amount;
    if (DIR_CREDIT.has(dir) && amount < 0) amount = -amount;
  }
  return amount;
}

// ── FALLBACK: row-based detection ─────────────────────────────────────────────
function parseRowFallback(row) {
  let date = null, amount = null, descCandidates = [];
  for (const cell of row) {
    const s = cell.trim();
    if (!s) continue;
    if (!date) {
      const d = parseDate(s);
      if (d) { date = d; continue; }
    }
    if (amount === null) {
      const a = parseAmount(s);
      if (a !== null && s.match(/[\d,\.]+/) && s.length <= 20) { amount = a; continue; }
    }
    descCandidates.push(s);
  }
  if (!date || amount === null) return null;
  const description = descCandidates.sort((a, b) => b.length - a.length)[0] || 'unknown transaction';
  return { date, amount, description };
}

// ── Main CSV parser ───────────────────────────────────────────────────────────
export function parseCSV(text) {
  const raw = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const delimiter = detectDelimiter(raw.slice(0, 4096));

  const rows = tokenizeCSV(raw, delimiter);
  if (rows.length < 1) return [];

  const headerIdx = findHeaderRow(rows);
  const headers   = rows[headerIdx].map(h => h.trim());

  const dataRows = rows.slice(headerIdx + 1);
  const cols = detectColumns(headers, dataRows);

  const result = [];
  const seen   = new Set();

  if (cols.date && cols.dateScore >= 3) {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const rawRow = rows[i];
      if (rawRow.length < 2) continue;

      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (rawRow[idx] || '').trim(); });

      const date = parseDate(obj[cols.date]);
      if (!date) continue;

      const amount = resolveSignedAmount(obj, cols);
      if (amount === null) continue;

      const fallbackCells = headers
        .filter(h => h !== cols.date && h !== cols.amt && h !== cols.debit &&
                     h !== cols.credit && h !== cols.balance && h !== cols.direction)
        .map(h => obj[h]);

      const description = cleanDescription(cols.desc ? obj[cols.desc] : null, fallbackCells);

      // FINAL MAPPING — type determined by sign, amount stored as absolute value
      const type  = amount < 0 ? 'expense' : 'income';
      const entry = { date, description, amount: Math.abs(amount), type };

      const key = dedupKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(entry);
    }

    if (result.length > 0) {
      return result;
    }
  }

  // Fallback: row-based heuristic
  for (let i = 0; i < rows.length; i++) {
    const parsed = parseRowFallback(rows[i]);
    if (!parsed) continue;
    const { date, amount, description } = parsed;
    const type  = amount < 0 ? 'expense' : 'income';
    const entry = { date, description, amount: Math.abs(amount), type };
    const key   = dedupKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }

  return result;
}

// ── Entry point ───────────────────────────────────────────────────────────────
export async function parseBankFile(buffer, fileType) {
  try {
    if (fileType === 'pdf') {
      const data = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
      return await parsePDF(data);
    }
    if (fileType === 'xlsx' || fileType === 'xls' || fileType === 'ods') {
      const data = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
      return await parseXLSX(data);
    }
    const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    const text  = typeof buffer === 'string' ? buffer : decodeBuffer(bytes);
    return parseCSV(text);
  } catch (err) {
    console.error('[parseBankFile] unexpected error:', err);
    return [];
  }
}
