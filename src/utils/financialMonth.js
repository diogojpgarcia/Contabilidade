/**
 * Financial month utilities.
 *
 * A financial month is identified by the YYYY-MM key of the calendar month it
 * STARTS in.  Example: startDay=25, key="2025-01" → Jan 25 – Feb 24 2025.
 * When startDay=1 the financial month is identical to the calendar month.
 */

/**
 * Map an ISO date string to its financial month key (YYYY-MM).
 * A date falls in the financial month that started on `startDay` of the
 * calendar month CONTAINING or PRECEDING the date.
 */
export function getFinancialMonthKey(dateStr, startDay = 1) {
  if (!dateStr) return '';
  if (startDay === 1) return dateStr.slice(0, 7);
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  const y   = d.getFullYear();
  const m   = d.getMonth(); // 0-indexed
  if (day >= startDay) {
    return `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  const prev = new Date(y, m - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Return { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } for the financial month.
 * monthKey is YYYY-MM (the month the period STARTS in).
 */
export function getFinancialMonthRange(monthKey, startDay = 1) {
  const [y, m] = monthKey.split('-').map(Number);
  if (startDay === 1) {
    const lastDay = new Date(y, m, 0).getDate(); // day-0 of next month = last day of this month
    return {
      start: `${monthKey}-01`,
      end:   `${monthKey}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  // Start: startDay of month m in year y (m is 1-indexed from split)
  const startDate = new Date(y, m - 1, startDay);
  // End: day before startDay of the NEXT calendar month
  // new Date(y, m, startDay - 1) — m is already the 0-indexed next month
  const endDate = new Date(y, m, startDay - 1);
  return {
    start: startDate.toISOString().split('T')[0],
    end:   endDate.toISOString().split('T')[0],
  };
}

/** True if dateStr (YYYY-MM-DD) falls within the financial month. */
export function isInFinancialMonth(dateStr, monthKey, startDay = 1) {
  if (!dateStr || !monthKey) return false;
  if (startDay === 1) return dateStr.startsWith(monthKey);
  const { start, end } = getFinancialMonthRange(monthKey, startDay);
  return dateStr >= start && dateStr <= end;
}

/** Filter a transaction array to the given financial month. */
export function filterByFinancialMonth(transactions, monthKey, startDay = 1) {
  return (transactions || []).filter(t => t.date && isInFinancialMonth(t.date, monthKey, startDay));
}

/**
 * Return the financial month key for today.
 * This is what `currentMonth` should be initialised to on startup.
 */
export function getCurrentFinancialMonth(startDay = 1) {
  const today = new Date();
  return getFinancialMonthKey(today.toISOString().split('T')[0], startDay);
}

/** Shift a financial month key by `delta` months (+1 = next, -1 = previous). */
export function shiftFinancialMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Human-readable label for a financial month.
 * Calendar mode: "janeiro 2025"
 * Financial mode: "25 jan – 24 fev 2025"
 */
export function getFinancialMonthLabel(monthKey, startDay = 1, locale = 'pt-PT') {
  if (startDay === 1) {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }
  const { start, end } = getFinancialMonthRange(monthKey, startDay);
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const fmt = (d) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  return `${fmt(s)} – ${fmt(e)} ${e.getFullYear()}`;
}

/**
 * Predict end-of-period spend extrapolating from current pace.
 * Works for both calendar and financial months.
 * Returns null when `selectedMonth` is not the current period.
 */
export function getPrediction(spent, selectedMonth, startDay = 1) {
  const today    = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const { start, end } = getFinancialMonthRange(selectedMonth, startDay);
  if (todayStr < start || todayStr > end) return null;
  const startDate  = new Date(start + 'T00:00:00');
  const endDate    = new Date(end   + 'T00:00:00');
  const daysTotal  = Math.round((endDate  - startDate) / 86400000) + 1;
  const daysPassed = Math.round((today    - startDate) / 86400000) + 1;
  if (daysPassed <= 0 || spent === 0) return null;
  return Math.round((spent / daysPassed) * daysTotal);
}
