// parseBankXlsx.js — XLSX/XLS bank statement parser (extracted from parseBankFile.js)
import { parseDate, parseAmount, cleanDescription } from './parseBankFile';

// Internal dedup key helper
function dedupKey(r) {
  return `${r.date}|${r.amount}|${(r.description || '').slice(0, 30)}`;
}

// ── XLSX parser ───────────────────────────────────────────────────────────────
// Uses SheetJS (xlsx) loaded dynamically to avoid bundling weight unless needed.
// Handles XLS, XLSX, ODS — any format SheetJS supports.
async function loadXLSX() {
  const XLSX = await import('xlsx');
  return XLSX.default ?? XLSX;
}

export export async function parseXLSX(buffer) {
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
      }

      if (amount === null) continue;

      const fallbackCells = headers
        .filter(h => h !== cols.date && h !== cols.amt && h !== cols.debit && h !== cols.credit)
        .map(h => obj[h]);

      const description = cleanDescription(cols.desc ? obj[cols.desc] : null, fallbackCells);

      const type  = amount < 0 ? 'expense' : 'income';
      const entry = { date, description, amount: Math.abs(amount), type };

      const key = dedupKey(entry);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(entry);
    }

    return result;
  } catch (err) {
    console.error('[parseXLSX] error:', err);
    return [];
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
