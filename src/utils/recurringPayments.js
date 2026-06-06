/**
 * Recurring Payments utilities.
 *
 * Pure functions — no React, no side-effects.
 * All date handling is local-timezone-safe by appending T00:00:00.
 */

import { getFinancialMonthRange } from './financialMonth';

/** Safe number — never NaN */
export const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ── Date helpers ────────────────────────────────────────────────────────────

function addMonths(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  const y = d.getFullYear();
  const m = d.getMonth() + n;
  const day = d.getDate();
  const target = new Date(y, m, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target.toISOString().split('T')[0];
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  const r = new Date(d.getTime() + safeNum(n) * 86400000);
  return r.toISOString().split('T')[0];
}

function addYears(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  return new Date(d.getFullYear() + n, d.getMonth(), d.getDate())
    .toISOString().split('T')[0];
}

export function advanceByFrequency(dateStr, payment) {
  const { frequency, customDays } = payment;
  if (frequency === 'monthly') return addMonths(dateStr, 1);
  if (frequency === 'weekly')  return addDays(dateStr, 7);
  if (frequency === 'yearly')  return addYears(dateStr, 1);
  return addDays(dateStr, safeNum(customDays) || 30);
}

export function computeNextDueDate(payment, fromDate = null) {
  const today = new Date().toISOString().split('T')[0];
  const from  = fromDate || today;
  const start = payment.startDate || today;

  if (start >= from) return start;

  const { frequency, customDays } = payment;
  const startMs = new Date(start + 'T00:00:00').getTime();
  const fromMs  = new Date(from  + 'T00:00:00').getTime();
  const diffMs  = fromMs - startMs;
  let d;

  if (frequency === 'weekly') {
    // Jump directly to the first occurrence >= from in O(1)
    const n = Math.ceil(diffMs / (7 * 86400000));
    d = addDays(start, n * 7);
  } else if (frequency === 'monthly') {
    const sd = new Date(start + 'T00:00:00');
    const fd = new Date(from  + 'T00:00:00');
    const monthDiff = (fd.getFullYear() - sd.getFullYear()) * 12
      + (fd.getMonth() - sd.getMonth());
    const n = Math.max(1, monthDiff);
    d = addMonths(start, n);
    // One extra step if addMonths landed on a short month and we're still behind
    if (d < from) d = addMonths(start, n + 1);
  } else if (frequency === 'yearly') {
    const sd = new Date(start + 'T00:00:00');
    const fd = new Date(from  + 'T00:00:00');
    const n  = Math.max(1, fd.getFullYear() - sd.getFullYear());
    d = addYears(start, n);
    if (d < from) d = addYears(start, n + 1);
  } else {
    // custom — math jump, tiny fallback loop (≤3 iterations) for edge cases
    const days = safeNum(customDays) || 30;
    const n = Math.max(1, Math.ceil(diffMs / (days * 86400000)));
    d = addDays(start, n * days);
    for (let guard = 0; d < from && guard < 3; guard++) {
      d = advanceByFrequency(d, payment);
    }
  }

  return d;
}

export function getOccurrencesInRange(payment, start, end) {
  if (!payment.startDate) return [];
  const first = computeNextDueDate(payment, start);
  if (first > end) return [];

  const dates = [];
  let d = first;
  for (let guard = 0; d <= end && guard < 500; guard++) {
    dates.push(d);
    d = advanceByFrequency(d, payment);
  }
  return dates;
}

export function getUpcomingPayments(payments, count = 5, fromDate = null) {
  const from = fromDate || new Date().toISOString().split('T')[0];
  return (payments || [])
    .filter(p => p.active !== false)
    .map(p => ({ ...p, computedNextDue: computeNextDueDate(p, from) }))
    .sort((a, b) => a.computedNextDue.localeCompare(b.computedNextDue))
    .slice(0, count);
}

export function getPaymentsInPeriod(payments, monthKey, startDay = 1) {
  if (!payments?.length || !monthKey) return [];
  const { start, end } = getFinancialMonthRange(monthKey, startDay);
  const result = [];
  for (const p of payments) {
    if (p.active === false) continue;
    for (const date of getOccurrencesInRange(p, start, end)) {
      result.push({ ...p, dueDate: date });
    }
  }
  return result.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function getMonthlyEquivalent(payment) {
  const amt = safeNum(payment.amount);
  const { frequency, customDays } = payment;
  if (frequency === 'monthly') return amt;
  if (frequency === 'weekly')  return amt * (52 / 12);
  if (frequency === 'yearly')  return amt / 12;
  const days = safeNum(customDays) || 30;
  return amt * (30 / days);
}

export function getTotalMonthlyCommitted(payments) {
  return (payments || [])
    .filter(p => p.active !== false)
    .reduce((s, p) => s + getMonthlyEquivalent(p), 0);
}

export const PAYMENT_TYPES = {
  fixed:    'fixed',
  variable: 'variable',
};

export const PAYMENT_TYPE_LABELS = {
  fixed:    'Fixo',
  variable: 'Variável',
};

export function getRecurringMonthKey(dateStr) {
  const s = dateStr ? String(dateStr) : new Date().toISOString();
  return s.slice(0, 7);
}

export function isConfirmedForMonth(recId, monthKey, confirmedRecurring) {
  return !!(confirmedRecurring?.[recId]?.[monthKey]);
}

export function getPendingConfirmations(payments, confirmedRecurring, fromDate = null) {
  const today = fromDate || new Date().toISOString().split('T')[0];
  const result = [];

  for (const p of (payments || [])) {
    if (p.active === false) continue;
    const due = computeNextDueDate(p, null);
    if (due > today) continue;
    const monthKey = getRecurringMonthKey(due);
    if (isConfirmedForMonth(p.id, monthKey, confirmedRecurring)) continue;
    result.push({ ...p, dueDate: due, monthKey });
  }

  return result.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export const FREQ_LABELS = {
  monthly: 'Mensal',
  weekly:  'Semanal',
  yearly:  'Anual',
  custom:  'Custom',
};

export const FREQ_OPTIONS = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'weekly',  label: 'Semanal' },
  { value: 'yearly',  label: 'Anual' },
  { value: 'custom',  label: 'Custom' },
];

export function relativeDueDate(dateStr) {
  const today = new Date().toISOString().split('T')[0];
  if (dateStr === today) return 'Hoje';
  const diff = Math.round(
    (new Date(dateStr + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000
  );
  if (diff === 1)   return 'Amanhã';
  if (diff < 0)     return `${Math.abs(diff)}d atrás`;
  if (diff < 7)     return `em ${diff}d`;
  if (diff < 31)    return `em ${Math.round(diff / 7)}sem`;
  return `em ${Math.round(diff / 30)}mês`;
}

export function shortDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}
