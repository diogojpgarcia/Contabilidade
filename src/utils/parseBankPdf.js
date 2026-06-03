// parseBankPdf.js — PDF bank statement parser (extracted from parseBankFile.js)
import { parseDate, parseAmount, cleanDescription } from './parseBankFile';

// Internal dedup key helper
function dedupKey(r) {
  return `${r.date}|${r.amount}|${(r.description || '').slice(0, 30)}`;
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

// ── PDF transaction helpers ────────────────────────────────────────────────────
// Shared by all three extraction paths so the same rules apply everywhere.

// Metadata lines to skip — headers, footers, IBAN rows, totals, etc.
// Kept as a single regex with word-boundary anchors to avoid false positives
// (e.g. a description containing "saldo" as a substring).
// Extended with Millennium BCP-specific fee / header / footer patterns.
// Word-boundary anchors prevent false positives on descriptions that merely
// *contain* these substrings (e.g. "Total Sport" → not matched by \btotal\b
// because "Sport" follows immediately — wait, it would match on "Total". So
// use the regex only as an early discard on lines that are clearly metadata.)
// Terms that are NEVER part of a real merchant name — always metadata/header/footer lines.
// Deliberately excludes "total", "montante", "taxa", "comissao" which DO appear in
// merchant names (e.g. "Total Sport", "Taxa-fix Café").
const PDF_NOISE_RE = /\b(nib|iban|bic|swift|saldo|extrato|extracto|p[aá]gina|pagina|titular|euronext|opera[çc][oõ]es de valor|atendimento telef[oó]nico)\b/i;

// A line is a transaction candidate only when it has ALL of:
//   • a date token  DD/MM or DD-MM  (required — pure metadata never has a date)
//   • a formatted monetary amount   (up to 3-digit groups + 2 decimal places)
// The date requirement is the strongest single filter: running balances, totals,
// IBAN rows, generic bank text, and fee descriptions never carry a date in the
// same line as a formatted amount.
function isTransaction(line) {
  const hasDate   = /\b\d{2}[\/\-]\d{2}\b/.test(line);
  const hasAmount = /[-+]?\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{2})/.test(line);
  return hasDate && hasAmount;
}

// Groups PDF text items into visual lines by y-coordinate (1pt precision).
// PDF y=0 is at the bottom, so we sort descending to get top-to-bottom order.
// 1pt precision (Math.round) keeps BCP's tightly-spaced adjacent lines separate;
// the old 3pt bucket (/ 3 * 3) was wide enough to merge two distinct lines.
function reconstructPdfLines(items) {
  const buckets = new Map();
  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = Math.round(item.transform[5]); // 1pt precision
    if (!buckets.has(y)) buckets.set(y, []);
    buckets.get(y).push(item);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, lineItems]) =>
      lineItems
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map(i => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean);
}

// Extracts transactions from reconstructed PDF lines.
// Date is matched anywhere on the line (BCP does not always lead with it) and
// carried forward to subsequent lines that have an amount but no explicit date.
// Lines that are clearly metadata (saldo, IBAN, etc.) are skipped.
function extractTransactionsFromLines(rawLines) {
  // Matches any monetary amount: handles 45,80 / 1.234,56 / 1 234,56 / 1234,56
  const MONEY_RE     = /[-+]?\d+(?:[.\s]\d{3})*[.,]\d{2}/g;
  // Date anywhere on the line — no start-of-line anchor
  const DATE_RE      = /\b(\d{2}[\/\-\.]\d{2}(?:[\/\-\.]\d{2,4})?)\b/;
  // Lines that are only a date with no description or amount
  const DATE_ONLY_RE = /^\d{2}[\/\-\.]\d{2}(?:[\/\-\.]\d{2,4})?$/;

  const INCOME_KW  = ['salario','vencimento','transferencia recebida','credito','abono',
    'reembolso','juros','dividendo','subsidio','remuneracao','ordenado','bonus'];
  const EXPENSE_KW = ['compra','pagamento','mbway','mb way','debito','levantamento',
    'transferencia enviada','comissao','taxa','mensalidade','anuidade','multibanco'];

  const seen     = new Set();
  const result   = [];
  let   lastDate = null;

  for (const line of rawLines) {
    // Always track dates — date-only lines still update carry-forward
    const dateMatch = line.match(DATE_RE);
    if (dateMatch) {
      const d = parseDate(dateMatch[1]);
      if (d) lastDate = d;
    }

    // ── Primary filter: must have BOTH a date token AND a monetary amount ──────
    // This is the strongest single filter — headers, footers, IBAN rows, balance
    // lines without an associated date all fail this test and are skipped early.
    if (!isTransaction(line)) continue;

    // ── Secondary filter: pure metadata lines that happen to carry a date+amount ─
    // (e.g. "Saldo anterior 15/05 1.234,56", "Extrato — Página 1 15/05 ...")
    // Only terms that NEVER appear in real merchant/description names are used here.
    if (PDF_NOISE_RE.test(line)) continue;

    // Skip long digit sequences (IBAN, account numbers, card numbers)
    if (/\d{8,}/.test(line)) continue;

    // Full amount scan
    const amtMatches = [...line.matchAll(MONEY_RE)];
    if (!amtMatches.length) continue;

    if (!lastDate) continue;

    // ── Smart amount selection ────────────────────────────────────────────────
    // Problem: a typical bank line is "15/05 Pagamento -25,00 1.234,56"
    //   • -25,00  → transaction (explicitly signed)
    //   • 1.234,56 → running balance (unsigned, rightmost)
    // Old code blindly took the LAST token → always returned the balance. Fix:
    //   1. Prefer an explicitly signed token (+/-) — that is the transaction amount.
    //   2. If no signed token, take the FIRST amount — the balance is always rightmost.
    const signedMatch = amtMatches.find(
      m => /^[+\-]/.test(m[0].trim()) || /[+\-]\s*$/.test(m[0].trim())
    );
    const rawAmt = signedMatch ? signedMatch[0] : amtMatches[0][0];
    const amount  = parseAmount(rawAmt.replace(/\s/g, ''));
    if (!amount || Math.abs(amount) < 0.01) continue;

    // Description: strip date token AND all amount tokens, keep the text in between
    let description = line;
    if (dateMatch) description = description.replace(dateMatch[0], '');
    for (const m of amtMatches) {
      description = description.replace(m[0], '');
    }
    description = description.replace(/\s+/g, ' ').trim() || 'unknown transaction';

    if (description.length < 5) continue;
    if (Math.abs(amount) > 10000 && !/[a-zA-ZÀ-ÿ]{4,}/.test(description)) continue;

    // Classify: explicit sign → most reliable; keywords fallback; default expense
    let type;
    if (/^\s*-/.test(rawAmt) || /-\s*$/.test(rawAmt)) {
      type = 'expense';
    } else if (/^\s*\+/.test(rawAmt)) {
      type = 'income';
    } else {
      const lower = norm(line);
      if (INCOME_KW.some(kw => lower.includes(kw)))       type = 'income';
      else if (EXPENSE_KW.some(kw => lower.includes(kw))) type = 'expense';
      else                                                  type = 'expense';
    }

    const entry = { date: lastDate, description, amount: Math.abs(amount), type };
    const key   = dedupKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }

  return result;
}

// Handles flat/flattened PDFs where all text items share the same y-coordinate
// so reconstructPdfLines collapses everything into one blob. Forces a newline
// before every date token, then delegates to extractTransactionsFromLines.
function extractTransactionsFromNormalized(text) {
  const normalized = text
    .replace(/\s+/g, ' ')
    // Inject newline before DD/MM or DD-MM patterns (with optional year).
    // Negative lookbehind avoids splitting mid-number (e.g. "001501" won't inject
    // before "15/01"). We match optional year so TX_RE still anchors correctly.
    .replace(/(?<!\d)(\d{2}[\/\-]\d{2}(?:[\/\-]\d{2,4})?)/g, '\n$1')
    .trim();

  const lines = normalized
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  // Re-use the same merge + parse + classify logic
  return extractTransactionsFromLines(lines);
}

// Fallback: flat single-line extraction (used when line-merge yields 0).
const DATE_RE   = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2})/;
const AMT_RE_G  = /([+-]?\s*\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2})/g;

function extractTransactionsFromText(text) {
  const lines  = text.split('\n').map(l => l.trim()).filter(Boolean);
  const seen   = new Set();
  const result = [];
  for (const line of lines) {
    // Apply the same noise + transaction-shape guards as the primary path
    if (PDF_NOISE_RE.test(line)) continue;
    if (/\d{8,}/.test(line)) continue;
    if (!isTransaction(line)) continue;

    const dateMatch = line.match(DATE_RE);
    if (!dateMatch) continue;
    const allAmt   = [...line.matchAll(AMT_RE_G)];
    const validAmt = allAmt.filter(m => {
      const digits = m[1].replace(/[^0-9]/g, '');
      return digits.length >= 1 && digits.length <= 10;
    });
    if (!validAmt.length) continue;
    const amtMatch = validAmt[validAmt.length - 1];
    const date   = parseDate(dateMatch[1]);
    if (!date) continue;
    const amount = parseAmount(amtMatch[1].replace(/\s/g, ''));
    if (amount === null) continue;
    const descRaw = line.replace(dateMatch[0], '').replace(amtMatch[0], '')
      .replace(/\s+/g, ' ').trim();
    const description = descRaw || 'unknown transaction';
    if (description.length < 5) continue;
    if (Math.abs(amount) > 10000 && !/[a-zA-ZÀ-ÿ]{4,}/.test(description)) continue;
    const type  = amount < 0 ? 'expense' : 'income';
    const entry = { date, description, amount: Math.abs(amount), type };
    const key   = dedupKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}


// ── Column-layout PDF extraction ──────────────────────────────────────────────
// Most Portuguese bank statement PDFs (BCP, CGD, BPI, Santander, Novo Banco)
// lay transactions in columns: Date | Description | Débito | Crédito | Saldo
// We detect the header row by x-position, then bin each item into its column.
// This solves two critical bugs in the line-based approach:
//   1. Balance taken instead of transaction amount (balance is rightmost column)
//   2. Expense/income direction lost (debit col = expense, credit col = income)

// Groups PDF items by y-coordinate with a ±3pt tolerance so items on the same
// visual line (which PDF may render at y=301 and y=303) end up in the same row.
function groupItemsByRow(items, tol = 3) {
  const rows = [];
  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    const y = item.transform[5];
    const x = item.transform[4];
    const existing = rows.find(r => Math.abs(r.y - y) <= tol);
    if (existing) {
      existing.items.push({ text: item.str.trim(), x });
    } else {
      rows.push({ y, items: [{ text: item.str.trim(), x }] });
    }
  }
  // Sort rows top-to-bottom (PDF y=0 is bottom, so descending y = top-to-bottom)
  rows.sort((a, b) => b.y - a.y);
  // Sort items within each row left-to-right
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows;
}

// Scans rows for a header row that labels Date, Debit, and/or Credit columns.
// Returns { headerY, cols } where cols maps column types to {xMin, xMax} ranges,
// or null if no recognisable column layout is found.
function detectColumnBounds(rows) {
  let bestRow = null;
  let bestScore = 0;

  for (const row of rows) {
    let score = 0;
    const found = new Set();
    for (const item of row.items) {
      const n = norm(item.text);
      if (!found.has('date')   && SCORE_DATE.some(k => n === k || n.includes(k)))   { score += 5; found.add('date'); }
      if (!found.has('debit')  && SCORE_DEBIT.some(k => n === k || n.includes(k)))  { score += 5; found.add('debit'); }
      if (!found.has('credit') && SCORE_CREDIT.some(k => n === k || n.includes(k))) { score += 5; found.add('credit'); }
      if (!found.has('desc')   && SCORE_DESC.some(k => n === k || n.includes(k)))   { score += 3; found.add('desc'); }
    }
    // Must have at least a date column + one amount column to be a useful layout
    if (score > bestScore && found.has('date') && (found.has('debit') || found.has('credit'))) {
      bestScore = score;
      bestRow = row;
    }
  }

  if (!bestRow) return null;

  // Map each header item to its column type
  const detected = {};
  for (const item of bestRow.items) {
    const n = norm(item.text);
    const ds  = SCORE_DATE.some(k => n === k || n.includes(k));
    const dbs = SCORE_DEBIT.some(k => n === k || n.includes(k));
    const crs = SCORE_CREDIT.some(k => n === k || n.includes(k));
    const dss = SCORE_DESC.some(k => n === k || n.includes(k));
    if      (ds  && !detected.date)   detected.date   = item.x;
    else if (dbs && !detected.debit)  detected.debit  = item.x;
    else if (crs && !detected.credit) detected.credit = item.x;
    else if (dss && !detected.desc)   detected.desc   = item.x;
  }

  // If no explicit desc column, infer it between date and first amount column
  if (!detected.desc && detected.date !== undefined) {
    const firstAmtX = Math.min(
      detected.debit  !== undefined ? detected.debit  : 9999,
      detected.credit !== undefined ? detected.credit : 9999
    );
    if (firstAmtX < 9999) detected.desc = detected.date + (firstAmtX - detected.date) * 0.25;
  }

  if (Object.keys(detected).length < 2) return null;

  // Build xMin/xMax for each column using midpoints between adjacent columns
  const sorted = Object.entries(detected).sort((a, b) => a[1] - b[1]);
  const bounds = {};
  for (let i = 0; i < sorted.length; i++) {
    const [type, x] = sorted[i];
    const prevX = i > 0 ? sorted[i - 1][1] : 0;
    const nextX = i < sorted.length - 1 ? sorted[i + 1][1] : 9999;
    bounds[type] = {
      xMin: i === 0 ? 0 : (x + prevX) / 2,
      xMax: i === sorted.length - 1 ? 9999 : (x + nextX) / 2,
    };
  }

  return { headerY: bestRow.y, cols: bounds };
}

// Returns which column type (date/desc/debit/credit) an x-coordinate falls into.
function colForX(x, bounds) {
  for (const [type, { xMin, xMax }] of Object.entries(bounds)) {
    if (x >= xMin && x < xMax) return type;
  }
  return null;
}

// Extracts transactions from a row-items list using detected column bounds.
// Handles multi-line descriptions: if a row has desc text but no date/amount,
// its text is appended to the previous pending transaction's description.
function extractByColumnBounds(rows, layout) {
  const { headerY, cols } = layout;
  const seen    = new Set();
  const result  = [];
  let lastDate  = null;
  let pending   = null;

  // Only look at rows BELOW the header (lower y in PDF space = visually below)
  const dataRows = rows.filter(r => r.y < headerY);

  for (const row of dataRows) {
    const bins = { date: [], desc: [], debit: [], credit: [] };

    for (const item of row.items) {
      const col = colForX(item.x, cols);
      if (col && bins[col]) bins[col].push(item.text);
    }

    const dateStr   = bins.date.join(' ').trim();
    const descStr   = bins.desc.join(' ').trim();
    const debitStr  = bins.debit.join(' ').trim();
    const creditStr = bins.credit.join(' ').trim();

    // Noise guard (saldo lines, etc.)
    const lineText = row.items.map(i => i.text).join(' ');
    if (PDF_NOISE_RE.test(lineText)) continue;

    const date    = dateStr  ? parseDate(dateStr)   : null;
    const debit   = debitStr  ? parseAmount(debitStr.replace(/\s/g, ''))  : null;
    const credit  = creditStr ? parseAmount(creditStr.replace(/\s/g, '')) : null;
    const hasAmt  = debit !== null || credit !== null;

    if (date) lastDate = date;

    if (lastDate && hasAmt) {
      // Flush previous pending entry before starting a new one
      if (pending) {
        pending.description = pending.description.trim() || 'unknown transaction';
        const key = dedupKey(pending);
        if (!seen.has(key)) { seen.add(key); result.push(pending); }
      }

      // Determine amount and direction from column position
      let amount, type;
      if (credit !== null && debit === null) {
        amount = Math.abs(credit); type = 'income';
      } else if (debit !== null && credit === null) {
        amount = Math.abs(debit);  type = 'expense';
      } else if (credit !== null && debit !== null) {
        // Both columns have a value — net (unusual but possible)
        amount = Math.abs(credit - debit);
        type   = credit >= debit ? 'income' : 'expense';
      } else {
        continue;
      }

      if (amount < 0.01) continue;

      pending = { date: lastDate, description: descStr, amount, type };

    } else if (descStr && pending && !hasAmt) {
      // Multi-line description continuation — append to previous transaction
      pending.description += ' ' + descStr;
    }
  }

  // Flush last pending entry
  if (pending) {
    pending.description = pending.description.trim() || 'unknown transaction';
    const key = dedupKey(pending);
    if (!seen.has(key)) { seen.add(key); result.push(pending); }
  }

  return result;
}

export async function parsePDF(buffer) {
  try {
    const pdfjsLib = await loadPdfJs();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    const allItems = [];   // raw items with x,y — for column detection
    const allLines = [];   // text-only lines — for line-based fallbacks
    let   fullText = '';

    for (let p = 1; p <= pdf.numPages; p++) {
      const page    = await pdf.getPage(p);
      const content = await page.getTextContent();
      allItems.push(...content.items);
      allLines.push(...reconstructPdfLines(content.items));
      fullText += content.items.map(i => i.str).join(' ') + '\n';
    }

    // ── Strategy 1: Column-layout detection ────────────────────────────────
    // Best for: Millennium BCP, BPI, Santander, Novo Banco, CGD
    // Uses x-coordinates to correctly identify Date | Desc | Débito | Crédito
    // columns, avoiding the "take last amount = balance" bug.
    const rowItems = groupItemsByRow(allItems);
    const layout   = detectColumnBounds(rowItems);
    if (layout) {
      const colResult = extractByColumnBounds(rowItems, layout);
      if (colResult.length >= 2) return colResult;
    }

    // ── Strategy 2: y-coordinate line reconstruction ────────────────────────
    // Best for: single-amount-column PDFs where the amount is explicitly signed.
    // Now fixed to prefer signed amounts over unsigned (balance) tokens.
    const lineResult = extractTransactionsFromLines(allLines);

    // ── Strategy 3: Date-injection normalization ────────────────────────────
    // Rescues flat/scanned PDFs where all text items share the same y-coordinate.
    const normResult = lineResult.length < 10
      ? extractTransactionsFromNormalized(fullText)
      : [];

    const best = normResult.length > lineResult.length ? normResult : lineResult;
    if (best.length > 0) return best;

    // ── Strategy 4: Flat single-line mode (last resort) ─────────────────────
    return extractTransactionsFromText(fullText);
  } catch (err) {
    console.error('[parseBankFile] PDF parse error:', err);
    return [];
  }
}

