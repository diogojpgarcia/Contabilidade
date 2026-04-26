// ─── Universal Bank Statement Parser ────────────────────────────────────────
// Supports any European bank CSV / PDF format.
// Never throws; always returns the best possible result.
// ─────────────────────────────────────────────────────────────────────────────

// ── Column keyword scoring tables ────────────────────────────────────────────
const SCORE_DATE = [
  'date','data','datum','fecha','valuta','buchungstag','booking','wertstellung',
  'movimento','data mov','data valor','transaction date','posting date','value date',
  'boekdatum','rekeningdatum','handelsdatum',
];
const SCORE_DESC = [
  'description','descricao','historico','movimento','details','detail',
  'omschrijving','verwendungszweck','memo','narration','reference','referencia',
  'text','label','transaction','hist','descr','bezeichnung','betreff','subject',
  'particulars','remark','remarks','note','notes','transaction details',
  'payment details','beneficiary','creditor name','naam','tegenrekening naam',
  'comunicacao','comunicação',
];
const SCORE_AMT = [
  'amount','valor','betrag','bedrag','importe','montant','montante','quantia',
  'total','net amount','transaction amount','movimento',
];
const SCORE_DEBIT = [
  'debit','debito','af','uitgaven','ausgabe','withdrawal','charge','debet',
  'kosten','saidas','saída',
];
const SCORE_CREDIT = [
  'credit','credito','bij','inkomsten','einnahme','deposit','payment','entradas',
  'entrada','receita',
];

// ── Normalisation helpers ─────────────────────────────────────────────────────
function norm(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-\.]/g, ' ')
    .trim();
}

function scoreHeader(header, keywords) {
  const h = norm(header);
  let best = 0;
  for (const kw of keywords) {
    if (h === kw)                         { best = Math.max(best, 10); break; }
    if (h.startsWith(kw + ' ') || h.endsWith(' ' + kw)) { best = Math.max(best, 7); }
    if (h.includes(kw))                   { best = Math.max(best, 5); }
    if (kw.includes(h) && h.length >= 3)  { best = Math.max(best, 3); }
  }
  return best;
}

// ── Delimiter detection ───────────────────────────────────────────────────────
function detectDelimiter(sample) {
  const candidates = [';', ',', '\t', '|'];
  const counts = {};
  for (const d of candidates) counts[d] = 0;
  let inQuote = false;
  for (const ch of sample) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (!inQuote && ch in counts) counts[ch]++;
  }
  // Prefer the delimiter that appears most consistently across first few rows
  const lines = sample.split(/\r?\n/).filter(l => l.trim()).slice(0, 5);
  let bestDelim = ',';
  let bestConsistency = -1;
  for (const d of candidates) {
    if (counts[d] === 0) continue;
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

// ── CSV tokeniser (handles quoted fields, CRLF, LF) ──────────────────────────
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
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  if ((m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)))
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  // YYYY-MM-DD or YYYY/MM/DD
  if ((m = s.match(/^(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})$/)))
    return `${m[1]}-${m[2]}-${m[3]}`;
  // DD/MM/YY
  if ((m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/))) {
    const yr = parseInt(m[3]) < 50 ? '20' + m[3] : '19' + m[3];
    return `${yr}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  // ISO or any parseable date string
  const d = new Date(s);
  if (!isNaN(d.getTime()) && s.length >= 8) return d.toISOString().slice(0, 10);
  return null;
}

function looksLikeDate(s) {
  return parseDate(s) !== null;
}

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
    .replace(/[€$£¥£¥]/g, '')
    .replace(/[()]/g, '')
    .replace(/[\s ]/g, '')
    .replace(/[+-]/g, '')
    .trim();

  if (!clean) return null;

  // Step 3 — normalise decimal separator
  const lastComma = clean.lastIndexOf(',');
  const lastDot   = clean.lastIndexOf('.');

  if (lastComma > lastDot) {
    // European: 1.234,56
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Anglo: 1,234.56
    clean = clean.replace(/,/g, '');
  } else {
    // Integer — remove separators
    clean = clean.replace(/[,.]/g, '');
  }

  // Step 4 — parse (n is always positive at this point)
  const n = parseFloat(clean);
  if (isNaN(n) || n === 0 && clean !== '0') return null;

  // Step 5 — apply sign; NO Math.abs here — caller decides direction
  return isNegative ? -n : n;
}

function looksLikeAmount(s) {
  return parseAmount(s) !== null;
}

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

// ── Duplicate key ─────────────────────────────────────────────────────────────
function dedupKey(r) {
  return `${r.date}|${r.amount}|${(r.description || '').slice(0, 30)}`;
}

// ── Header-based column detection ─────────────────────────────────────────────
function detectColumns(headers) {
  const cols = {
    date: null,   dateScore: 0,
    desc: null,   descScore: 0,
    amt:  null,   amtScore:  0,
    debit: null,  debitScore: 0,
    credit: null, creditScore: 0,
  };
  for (const h of headers) {
    const hn = norm(h);
    if (!hn) continue;

    const ds = scoreHeader(h, SCORE_DATE);
    if (ds > cols.dateScore) { cols.dateScore = ds; cols.date = h; }

    const dss = scoreHeader(h, SCORE_DESC);
    if (dss > cols.descScore) { cols.descScore = dss; cols.desc = h; }

    const as = scoreHeader(h, SCORE_AMT);
    if (as > cols.amtScore) { cols.amtScore = as; cols.amt = h; }

    const dbs = scoreHeader(h, SCORE_DEBIT);
    if (dbs > cols.debitScore) { cols.debitScore = dbs; cols.debit = h; }

    const crs = scoreHeader(h, SCORE_CREDIT);
    if (crs > cols.creditScore) { cols.creditScore = crs; cols.credit = h; }
  }

  if (import.meta.env?.DEV) {
    console.debug('[parseBankFile] column scores:', {
      date:  `${cols.date} (${cols.dateScore})`,
      desc:  `${cols.desc} (${cols.descScore})`,
      amt:   `${cols.amt} (${cols.amtScore})`,
      debit: `${cols.debit} (${cols.debitScore})`,
      credit:`${cols.credit} (${cols.creditScore})`,
    });
  }

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
  return 0; // Default to first row
}

// ── Row-level amount resolution ───────────────────────────────────────────────
// ── Row-level amount resolution ───────────────────────────────────────────────
// Rules:
//   debit col only  → negative (expense)
//   credit col only → positive (income)
//   both cols populated → whichever is non-zero (credit wins only if debit is 0)
//   single signed amount col → keep sign as-is from parseAmount
function resolveAmount(obj, cols) {
  const hasDebitCredit = (cols.debitScore >= 5 || cols.creditScore >= 5);

  if (hasDebitCredit) {
    const rawDebit  = cols.debit  ? parseAmount(obj[cols.debit])  : null;
    const rawCredit = cols.credit ? parseAmount(obj[cols.credit]) : null;
    // Take absolute values for magnitude comparison — sign comes from column semantics
    const debitAbs  = rawDebit  !== null ? Math.abs(rawDebit)  : 0;
    const creditAbs = rawCredit !== null ? Math.abs(rawCredit) : 0;

    // Only credit populated → income (positive)
    if (creditAbs > 0 && debitAbs === 0) return  creditAbs;
    // Only debit populated → expense (negative)
    if (debitAbs  > 0 && creditAbs === 0) return -debitAbs;
    // Both populated → net (uncommon, but handle gracefully)
    if (creditAbs > 0 && debitAbs > 0) return creditAbs - debitAbs;
  }

  // Single signed amount column — sign already preserved by parseAmount
  if (cols.amt && obj[cols.amt] !== undefined && obj[cols.amt] !== '') {
    const a = parseAmount(obj[cols.amt]);
    if (a !== null) {
      if (import.meta.env?.DEV)
        console.debug('[parseBankFile] amt col raw:', obj[cols.amt], '→', a);
      return a;
    }
  }

  // Low-confidence debit/credit fallback
  if (cols.debit || cols.credit) {
    const rawDebit  = cols.debit  ? parseAmount(obj[cols.debit])  : null;
    const rawCredit = cols.credit ? parseAmount(obj[cols.credit]) : null;
    const debitAbs  = rawDebit  !== null ? Math.abs(rawDebit)  : 0;
    const creditAbs = rawCredit !== null ? Math.abs(rawCredit) : 0;
    if (creditAbs > 0 && debitAbs === 0) return  creditAbs;
    if (debitAbs  > 0 && creditAbs === 0) return -debitAbs;
    if (creditAbs > 0 && debitAbs > 0)   return creditAbs - debitAbs;
  }

  return null;
}

// ── FALLBACK: row-based detection (no header) ─────────────────────────────────
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
  // Strip BOM
  const raw = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const delimiter = detectDelimiter(raw.slice(0, 4096));

  if (import.meta.env?.DEV) {
    console.debug('[parseBankFile] delimiter:', JSON.stringify(delimiter));
  }

  const rows = tokenizeCSV(raw, delimiter);
  if (rows.length < 1) return [];

  const headerIdx = findHeaderRow(rows);
  const headers   = rows[headerIdx].map(h => h.trim());
  const cols      = detectColumns(headers);

  const result = [];
  const seen   = new Set();

  // ── Header-mode parsing ────────────────────────────────────────────────────
  if (cols.dateScore >= 3) {
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const rawRow = rows[i];
      if (rawRow.length < 2) continue;

      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (rawRow[idx] || '').trim(); });

      const date = parseDate(obj[cols.date]);
      if (!date) continue;

      const amount = resolveAmount(obj, cols);
      if (amount === null) continue;

      const fallbackCells = headers
        .filter(h => h !== cols.date && h !== cols.amt && h !== cols.debit && h !== cols.credit)
        .map(h => obj[h]);

      const description = cleanDescription(cols.desc ? obj[cols.desc] : null, fallbackCells);
      if (import.meta.env?.DEV) console.debug(`[parseBankFile] row ${i}: rawAmount=${amount} type=${amount < 0 ? "expense" : "income"} desc="${description?.slice(0,25)}"`);
      const type  = amount < 0 ? 'expense' : 'income';
      const entry = { date, description, amount: Math.abs(amount), type };
      const key   = dedupKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(entry);
    }

    if (result.length > 0) {
      if (import.meta.env?.DEV) console.debug('[parseBankFile] header-mode rows:', result.length);
      return result;
    }
  }

  // ── Fallback: row-based detection ─────────────────────────────────────────
  if (import.meta.env?.DEV) console.debug('[parseBankFile] switching to fallback row mode');

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

  if (import.meta.env?.DEV) console.debug('[parseBankFile] fallback-mode rows:', result.length);
  return result;
}

// ── PDF support ───────────────────────────────────────────────────────────────
async function loadPdfJs() {
  const pdfjsLib = await import('pdfjs-dist');
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).href;
  }
  return pdfjsLib;
}

const DATE_RE = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2})/;
const AMT_RE  = /([+-]?\s*\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2})/;

function extractTransactionsFromText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const seen   = new Set();
  const result = [];

  for (const line of lines) {
    const dateMatch = line.match(DATE_RE);
    const amtMatch  = line.match(AMT_RE);
    if (!dateMatch || !amtMatch) continue;

    const date = parseDate(dateMatch[1]);
    if (!date) continue;
    const amount = parseAmount(amtMatch[1].replace(/\s/g, ''));
    if (amount === null) continue;

    const descRaw = line
      .replace(dateMatch[0], '')
      .replace(amtMatch[0], '')
      .replace(/\s+/g, ' ')
      .trim();
    const description = descRaw || 'unknown transaction';
    const type  = amount < 0 ? 'expense' : 'income';
    const entry = { date, description, amount: Math.abs(amount), type };
    const key   = dedupKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

export async function parsePDF(buffer) {
  try {
    const pdfjsLib = await loadPdfJs();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    let fullText = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page    = await pdf.getPage(p);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }
    return extractTransactionsFromText(fullText);
  } catch (err) {
    console.error('[parseBankFile] PDF parse error:', err);
    return [];
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
export async function parseBankFile(buffer, fileType) {
  try {
    if (fileType === 'pdf') {
      const data = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
      return await parsePDF(data);
    }
    const text = buffer instanceof ArrayBuffer
      ? new TextDecoder().decode(buffer)
      : typeof buffer === 'string' ? buffer
      : new TextDecoder().decode(buffer);
    return parseCSV(text);
  } catch (err) {
    console.error('[parseBankFile] unexpected error:', err);
    return [];
  }
}
