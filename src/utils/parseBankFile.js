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
  'comunicacao','comunicacao',
];
const SCORE_AMT = [
  'amount','valor','betrag','bedrag','importe','montant','montante','quantia',
  'total','net amount','transaction amount','movimento',
];
const SCORE_DEBIT = [
  'debit','debito','debito','db','deb','af','uitgaven','ausgabe',
  'withdrawal','charge','debet','kosten','saidas','saida',
];
const SCORE_CREDIT = [
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
    console.log('[parseBankFile] encoding: UTF-8 produced', replacements,
      'replacement chars — retrying as windows-1252');
    return new TextDecoder('windows-1252').decode(bytes);
  }

  return utf8;
}

// ── Normalisation helpers ─────────────────────────────────────────────────────
function norm(s) {
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

// ── Column detection ─────────────────────────────────────────────────────────
function detectColumns(headers) {
  const cols = {
    date: null,   dateScore: 0,
    desc: null,   descScore: 0,
    amt:  null,   amtScore:  0,
    debit: null,  debitScore: 0,
    credit: null, creditScore: 0,
  };
  for (const h of headers) {
    if (!norm(h)) continue;
    const ds  = scoreHeader(h, SCORE_DATE);
    if (ds  > cols.dateScore)  { cols.dateScore  = ds;  cols.date   = h; }
    const dss = scoreHeader(h, SCORE_DESC);
    if (dss > cols.descScore)  { cols.descScore  = dss; cols.desc   = h; }
    const as  = scoreHeader(h, SCORE_AMT);
    if (as  > cols.amtScore)   { cols.amtScore   = as;  cols.amt    = h; }
    const dbs = scoreHeader(h, SCORE_DEBIT);
    if (dbs > cols.debitScore) { cols.debitScore  = dbs; cols.debit  = h; }
    const crs = scoreHeader(h, SCORE_CREDIT);
    if (crs > cols.creditScore){ cols.creditScore = crs; cols.credit = h; }
  }

  console.log('[parseBankFile] COLUMN DETECTION:', {
    date:   `"${cols.date}" (score ${cols.dateScore})`,
    desc:   `"${cols.desc}" (score ${cols.descScore})`,
    amt:    `"${cols.amt}" (score ${cols.amtScore})`,
    debit:  `"${cols.debit}" (score ${cols.debitScore})`,
    credit: `"${cols.credit}" (score ${cols.creditScore})`,
  });

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

// ── Row-level amount resolution ───────────────────────────────────────────────
// Debit col value  → negative (expense)
// Credit col value → positive (income)
// Single signed amt col → pass through as-is
function resolveAmount(obj, cols) {
  const hasDebitCredit = (cols.debitScore >= 5 || cols.creditScore >= 5);

  if (hasDebitCredit) {
    const rawDebit  = cols.debit  ? obj[cols.debit]  : '';
    const rawCredit = cols.credit ? obj[cols.credit] : '';

    console.log('[parseBankFile] DEBIT/CREDIT RAW:',
      { debitCol: cols.debit, raw: rawDebit, creditCol: cols.credit, rawCredit });

    const debitVal  = rawDebit  ? parseAmount(rawDebit)  : null;
    const creditVal = rawCredit ? parseAmount(rawCredit) : null;
    const debitAbs  = debitVal  !== null ? Math.abs(debitVal)  : 0;
    const creditAbs = creditVal !== null ? Math.abs(creditVal) : 0;

    console.log('[parseBankFile] DEBIT/CREDIT PARSED:',
      { debitAbs, creditAbs });

    if (creditAbs > 0 && debitAbs === 0) return  creditAbs;   // income
    if (debitAbs  > 0 && creditAbs === 0) return -debitAbs;   // expense
    if (creditAbs > 0 && debitAbs  > 0)  return  creditAbs - debitAbs; // net
  }

  // Single signed amount column
  if (cols.amt && obj[cols.amt] !== undefined && obj[cols.amt] !== '') {
    const raw = obj[cols.amt];
    const a   = parseAmount(raw);
    console.log('[parseBankFile] AMT COL RAW:', raw, '→ parsed:', a);
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
  console.log('[parseBankFile] delimiter:', JSON.stringify(delimiter));

  const rows = tokenizeCSV(raw, delimiter);
  if (rows.length < 1) return [];

  const headerIdx = findHeaderRow(rows);
  const headers   = rows[headerIdx].map(h => h.trim());
  console.log('[parseBankFile] HEADERS (raw):', headers);
  console.log('[parseBankFile] HEADERS (normed):', headers.map(norm));

  const cols = detectColumns(headers);

  const result = [];
  const seen   = new Set();

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

      // FINAL MAPPING — type determined by sign, amount stored as absolute value
      const type  = amount < 0 ? 'expense' : 'income';
      const entry = { date, description, amount: Math.abs(amount), type };

      console.log('[parseBankFile] ROW', i, '| rawAmount:', amount,
        '| type:', type, '| amount:', entry.amount, '| desc:', description.slice(0, 30));

      const key = dedupKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(entry);
    }

    if (result.length > 0) {
      console.log('[parseBankFile] header-mode: parsed', result.length, 'rows');
      return result;
    }
  }

  // Fallback: row-based heuristic
  console.log('[parseBankFile] switching to fallback row-heuristic mode');
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

  console.log('[parseBankFile] fallback-mode: parsed', result.length, 'rows');
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
  const lines  = text.split('\n').map(l => l.trim()).filter(Boolean);
  const seen   = new Set();
  const result = [];
  for (const line of lines) {
    const dateMatch = line.match(DATE_RE);
    const amtMatch  = line.match(AMT_RE);
    if (!dateMatch || !amtMatch) continue;
    const date   = parseDate(dateMatch[1]);
    if (!date) continue;
    const amount = parseAmount(amtMatch[1].replace(/\s/g, ''));
    if (amount === null) continue;
    const descRaw = line.replace(dateMatch[0], '').replace(amtMatch[0], '')
      .replace(/\s+/g, ' ').trim();
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

// ── XLSX parser ───────────────────────────────────────────────────────────────
// Uses SheetJS (xlsx) loaded dynamically to avoid bundling weight unless needed.
// Handles XLS, XLSX, ODS — any format SheetJS supports.
async function loadXLSX() {
  const XLSX = await import('xlsx');
  return XLSX.default ?? XLSX;
}

export async function parseXLSX(buffer) {
  try {
    const XLSX  = await loadXLSX();
    const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;

    const workbook = XLSX.read(bytes, {
      type: 'array',
      cellDates: true,   // parse date cells as JS Date objects
      cellNF: false,     // skip raw number formats
      cellText: false,   // skip formatted text — use raw values
    });

    // Use first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet     = workbook.Sheets[sheetName];

    // Convert to array-of-arrays to find the header row manually
    const raw = XLSX.utils.sheet_to_json(sheet, {
      header: 1,         // return array of arrays
      defval: '',        // empty cells → empty string
      blankrows: false,
    });

    console.log('[parseXLSX] sheet:', sheetName, '| rows:', raw.length);
    if (raw.length < 2) return [];

    // Find header row (first row with 2+ recognisable column names)
    const allKeys = [
      ...SCORE_DATE, ...SCORE_DESC, ...SCORE_AMT, ...SCORE_DEBIT, ...SCORE_CREDIT,
    ];
    let headerIdx = 0;
    for (let i = 0; i < Math.min(8, raw.length); i++) {
      const rowNorm = raw[i].map(c => norm(String(c)));
      const hits = rowNorm.filter(h => allKeys.some(k => h === k || h.includes(k)));
      if (hits.length >= 2) { headerIdx = i; break; }
    }

    const headers = raw[headerIdx].map(c => String(c).trim());
    console.log('[parseXLSX] HEADERS (raw):', headers);
    console.log('[parseXLSX] HEADERS (normed):', headers.map(norm));

    const cols = detectColumns(headers);

    const result = [];
    const seen   = new Set();

    for (let i = headerIdx + 1; i < raw.length; i++) {
      const rawRow = raw[i];
      if (!rawRow || rawRow.every(c => c === '' || c == null)) continue;

      const obj = {};
      headers.forEach((h, idx) => {
        const cell = rawRow[idx];
        // SheetJS returns Date objects for date cells; convert to ISO string
        if (cell instanceof Date) {
          obj[h] = cell.toISOString().slice(0, 10);
        } else {
          obj[h] = cell != null ? String(cell).trim() : '';
        }
      });

      const date = parseDate(obj[cols.date]);
      if (!date) continue;

      // ── Amount resolution ────────────────────────────────────────────────
      let amount = null;

      if (cols.debitScore >= 3 || cols.creditScore >= 3) {
        const rawDebit  = cols.debit  ? obj[cols.debit]  : '';
        const rawCredit = cols.credit ? obj[cols.credit] : '';

        console.log('[parseXLSX] row', i, 'DEBIT:', rawDebit, '| CREDIT:', rawCredit);

        const debitVal  = rawDebit  ? parseAmount(rawDebit)  : null;
        const creditVal = rawCredit ? parseAmount(rawCredit) : null;
        const debitAbs  = debitVal  !== null ? Math.abs(debitVal)  : 0;
        const creditAbs = creditVal !== null ? Math.abs(creditVal) : 0;

        if (creditAbs > 0 && debitAbs === 0) amount =  creditAbs;   // income
        if (debitAbs  > 0 && creditAbs === 0) amount = -debitAbs;   // expense
        if (creditAbs > 0 && debitAbs  > 0)  amount =  creditAbs - debitAbs;
      }

      if (amount === null && cols.amt && obj[cols.amt]) {
        const raw = obj[cols.amt];
        amount = parseAmount(raw);
        console.log('[parseXLSX] row', i, 'AMT col:', raw, '→', amount);
      }

      if (amount === null) continue;

      const fallbackCells = headers
        .filter(h => h !== cols.date && h !== cols.amt && h !== cols.debit && h !== cols.credit)
        .map(h => obj[h]);

      const description = cleanDescription(cols.desc ? obj[cols.desc] : null, fallbackCells);

      const type  = amount < 0 ? 'expense' : 'income';
      const entry = { date, description, amount: Math.abs(amount), type };

      console.log('[parseXLSX] row', i, '| rawAmount:', amount,
        '| type:', type, '| stored:', entry.amount, '| desc:', description.slice(0, 30));

      const key = dedupKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(entry);
    }

    console.log('[parseXLSX] parsed', result.length, 'transactions');
    return result;
  } catch (err) {
    console.error('[parseXLSX] error:', err);
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
