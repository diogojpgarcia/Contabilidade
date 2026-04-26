const DATE_KEYS   = ['date','data','datum','fecha','valuta','buchungstag','booking date','transaction date','posting date','value date'];
const DESC_KEYS   = [
  'description','descricao','descricao','historico','historico','movimento',
  'details','detail','info','omschrijving','verwendungszweck','memo',
  'narration','reference','text','label','transaction','hist','descr',
  'bezeichnung','betreff','subject','particulars','remark','remarks','note','notes',
  'transaction details','payment details','beneficiary','creditor name'
];
const AMT_KEYS    = ['amount','valor','betrag','bedrag','importe','montant'];
const DEBIT_KEYS  = ['debit','debito','af','ausgabe','withdrawal','charge','debet'];
const CREDIT_KEYS = ['credit','credito','bij','einnahme','deposit','payment'];

function norm(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function detectDelimiter(text) {
  const sample = text.slice(0, 4096);
  const scores = { ',': 0, ';': 0, '\t': 0 };
  for (const ch of sample) if (ch in scores) scores[ch]++;
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

function findColumn(headers, candidates) {
  const normed = headers.map(norm);
  // Score each header: exact match = 3, startsWith = 2, includes = 1
  let bestHeader = null;
  let bestScore = 0;
  for (let i = 0; i < normed.length; i++) {
    const h = normed[i];
    for (const c of candidates) {
      let score = 0;
      if (h === c) score = 3;
      else if (h.startsWith(c) || c.startsWith(h)) score = 2;
      else if (h.includes(c) || c.includes(h)) score = 1;
      if (score > bestScore) {
        bestScore = score;
        bestHeader = headers[i];
      }
    }
  }
  return bestScore > 0 ? bestHeader : null;
}

export function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m;
  if ((m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)))
    return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if ((m = s.match(/^(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})$/)))
    return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export function parseAmount(raw) {
  if (raw == null || raw === '') return null;
  let s = String(raw).replace(/[€$£\u00a3\s]/g, '').trim();
  if (!s || s === '-' || s === '+') return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot   = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export function cleanDescription(raw, fallbackValues) {
  if (raw && String(raw).trim()) {
    const cleaned = String(raw).replace(/\s+/g, ' ').trim();
    if (cleaned) return cleaned;
  }
  // Try fallback values (other row cells) in order
  if (Array.isArray(fallbackValues)) {
    for (const val of fallbackValues) {
      if (val && String(val).trim()) {
        const cleaned = String(val).replace(/\s+/g, ' ').trim();
        if (cleaned) return cleaned;
      }
    }
  }
  return 'no description';
}

function generateRowKey(r) {
  return `${r.date}|${r.amount}|${(r.description || '').slice(0, 30)}`;
}

function tokenizeCSV(text, delimiter) {
  const rows = [];
  let row = [], cell = '', inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') { cell += '"'; i++; }
      else inQuote = !inQuote;
    } else if (!inQuote && ch === delimiter) {
      row.push(cell); cell = '';
    } else if (!inQuote && (ch === '\n' || (ch === '\r' && text[i + 1] === '\n'))) {
      if (ch === '\r') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim())) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) { row.push(cell); if (row.some(c => c.trim())) rows.push(row); }
  return rows;
}

export function parseCSV(text) {
  const bom = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const delimiter = detectDelimiter(bom);
  const rows = tokenizeCSV(bom, delimiter);
  if (rows.length < 2) return [];

  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const rowNorm = rows[i].map(norm);
    if ([...DATE_KEYS, ...DESC_KEYS, ...AMT_KEYS, ...DEBIT_KEYS, ...CREDIT_KEYS]
        .some(k => rowNorm.some(h => h === k || h.includes(k)))) {
      headerIdx = i; break;
    }
  }

  const headers = rows[headerIdx].map(h => h.trim());
  const dateCol   = findColumn(headers, DATE_KEYS);
  const descCol   = findColumn(headers, DESC_KEYS);
  const amtCol    = findColumn(headers, AMT_KEYS);
  const debitCol  = findColumn(headers, DEBIT_KEYS);
  const creditCol = findColumn(headers, CREDIT_KEYS);

  if (import.meta.env?.DEV) {
    console.debug('[parseBankFile] headers:', headers);
    console.debug('[parseBankFile] detected:', { dateCol, descCol, amtCol, debitCol, creditCol });
  }

  if (!dateCol) return [];

  const seen = new Set();
  const result = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const raw = rows[i];
    if (raw.length < 2) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (raw[idx] || '').trim(); });

    const date = parseDate(obj[dateCol]);
    if (!date) continue;

    // Build fallback list: all non-key cells for description fallback
    const nonKeyValues = headers
      .filter(h => h !== dateCol && h !== amtCol && h !== debitCol && h !== creditCol)
      .map(h => obj[h])
      .filter(v => v && v.trim());

    const description = cleanDescription(descCol ? obj[descCol] : null, nonKeyValues);

    let amount = null;
    if (amtCol && obj[amtCol]) {
      amount = parseAmount(obj[amtCol]);
    } else if (debitCol || creditCol) {
      const debit  = debitCol  ? parseAmount(obj[debitCol])  : null;
      const credit = creditCol ? parseAmount(obj[creditCol]) : null;
      if (credit != null && Math.abs(credit) > 0) amount = Math.abs(credit);
      else if (debit != null && Math.abs(debit) > 0) amount = -Math.abs(debit);
    }

    if (amount == null) continue;

    const type = amount < 0 ? 'expense' : 'income';
    const entry = { date, description, amount: Math.abs(amount), type };
    const key = generateRowKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }

  return result;
}

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

function extractTransactionsFromText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const DATE_RE = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2})/;
  const AMT_RE  = /([+-]?\s*\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2})/;
  const seen = new Set();
  const result = [];
  for (const line of lines) {
    const dateMatch = line.match(DATE_RE);
    const amtMatch  = line.match(AMT_RE);
    if (!dateMatch || !amtMatch) continue;
    const date = parseDate(dateMatch[1]);
    if (!date) continue;
    const amount = parseAmount(amtMatch[1]);
    if (amount == null) continue;
    const descRaw = line.replace(dateMatch[0], '').replace(amtMatch[0], '').replace(/\s+/g, ' ').trim();
    const description = descRaw || 'no description';
    const type = amount < 0 ? 'expense' : 'income';
    const entry = { date, description, amount: Math.abs(amount), type };
    const key = generateRowKey(entry);
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
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }
    return extractTransactionsFromText(fullText);
  } catch (err) {
    console.error('PDF parse error:', err);
    return [];
  }
}

export async function parseBankFile(buffer, fileType) {
  if (fileType === 'pdf') {
    return parsePDF(buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer);
  }
  const text = buffer instanceof ArrayBuffer
    ? new TextDecoder().decode(buffer)
    : typeof buffer === 'string' ? buffer : new TextDecoder().decode(buffer);
  return parseCSV(text);
}
