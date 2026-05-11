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

/** Advance a date by one payment period */
export function advanceByFrequency(dateStr, payment) {
  const { frequency, customDays } = payment;
  if (frequency === 'monthly') return addMonths(dateStr, 1);
  if (frequency === 'weekly')  return addDays(dateStr, 7);
  if (frequency === 'yearly')  return addYears(dateStr, 1);
  return addDays(dateStr, safeNum(customDays) || 30);
}

/**
 * Compute the next due date >= fromDate.
 * Always returns a valid YYYY-MM-DD string.
 */
export function computeNextDueDate(payment, fromDate = null) {
  const today = new Date().toISOString().split('T')[0];
  const from  = fromDate || today;
  const start = payment.startDate || today;

  if (start >= from) return start;

  let d = start;
  for (let guard = 0; d < from && guard < 2000; guard++) {
    d = advanceByFrequency(d, payment);
  }
  return d;
}

/**
 * All occurrences of a payment in the inclusive date range [start, end].
 * Returns sorted array of YYYY-MM-DD strings.
 */
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

/**
 * Get the next `count` upcoming payment occurrences, sorted by date.
 * Each item is { ...payment, computedNextDue }.
 */
export function getUpcomingPayments(payments, count = 5, fromDate = null) {
  const from = fromDate || new Date().toISOString().split('T')[0];
  return (payments || [])
    .filter(p => p.active !== false)
    .map(p => ({ ...p, computedNextDue: computeNextDueDate(p, from) }))
    .sort((a, b) => a.computedNextDue.localeCompare(b.computedNextDue))
    .slice(0, count);
}

/**
 * All payment occurrences within a financial month, sorted by date.
 * Each item is { ...payment, dueDate }.
 */
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

/**
 * Monthly equivalent cost of a single payment for budget planning.
 */
export function getMonthlyEquivalent(payment) {
  const amt = safeNum(payment.amount);
  const { frequency, customDays } = payment;
  if (frequency === 'monthly') return amt;
  if (frequency === 'weekly')  return amt * (52 / 12);
  if (frequency === 'yearly')  return amt / 12;
  const days = safeNum(customDays) || 30;
  return amt * (30 / days);
}

/**
 * Total monthly committed amount across all active payments.
 */
export function getTotalMonthlyCommitted(payments) {
  return (payments || [])
    .filter(p => p.active !== false)
    .reduce((s, p) => s + getMonthlyEquivalent(p), 0);
}

// ── Labels ──────────────────────────────────────────────────────────────────

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

/**
 * Human-readable relative due date (Portuguese).
 */
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

/**
 * Format a YYYY-MM-DD to "D MMM" (e.g. "15 jan").
 */
export function shortDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
}
