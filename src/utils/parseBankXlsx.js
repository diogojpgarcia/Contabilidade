// parseBankXlsx.js — XLSX/XLS bank statement parser (extracted from parseBankFile.js)
import {
  parseDate, cleanDescription, resolveSignedAmount,
  norm, detectColumns,
  SCORE_DATE, SCORE_DESC, SCORE_AMT, SCORE_DEBIT, SCORE_CREDIT,
} from './parseBankFile';

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

    // Normaliza cada linha para strings (datas locais, não UTC) para a deteção
    // data-driven e para a resolução por linha.
    const cellToStr = (c) => {
      if (c instanceof Date) {
        return `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`;
      }
      return c != null ? String(c).trim() : '';
    };
    const dataMatrix = raw.slice(headerIdx + 1).map(r => headers.map((h, idx) => cellToStr(r[idx])));

    const cols = detectColumns(headers, dataMatrix);

    const result = [];
    const seen   = new Set();

    for (const rawRow of dataMatrix) {
      if (!rawRow || rawRow.every(c => c === '')) continue;

      const obj = {};
      headers.forEach((h, idx) => { obj[h] = rawRow[idx] || ''; });

      const date = parseDate(obj[cols.date]);
      if (!date) continue;

      const amount = resolveSignedAmount(obj, cols);
      if (amount === null) continue;

      const fallbackCells = headers
        .filter(h => h !== cols.date && h !== cols.amt && h !== cols.debit &&
                     h !== cols.credit && h !== cols.balance && h !== cols.direction)
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
