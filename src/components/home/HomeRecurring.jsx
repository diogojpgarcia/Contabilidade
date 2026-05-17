import React, { useMemo } from 'react';
import {
  getUpcomingPayments,
  relativeDueDate,
  safeNum,
  isConfirmedForMonth,
  getRecurringMonthKey,
} from '../../utils/recurringPayments';
import { CategoryIconBubble } from '../../utils/categoryIcons';
import CosmosCard from '../cosmos/CosmosCard';
import CosmosSectionHeader from '../cosmos/CosmosSectionHeader';
import '../budget/Recurring.css';

/* ── Logic unchanged ────────────────────────────────────────────────────── */
const HomeRecurring = ({ recurringPayments, confirmedRecurring = {}, categories }) => {
  const expCats = categories?.expense || [];

  const upcoming = useMemo(
    () => getUpcomingPayments(recurringPayments, 5),
    [recurringPayments],
  );

  if (!upcoming.length) return null;

  const today = new Date().toISOString().split('T')[0];

  const catLabel = (p) =>
    expCats.find(c => c.id === p.categoryId)?.label || '';

  const dueClass = (due) => {
    if (due === today) return 'today';
    const diff = Math.round(
      (new Date(due + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000,
    );
    if (diff <= 1) return 'urgent';
    if (diff <= 5) return 'soon';
    return '';
  };

  return (
    <CosmosCard variant="standard">

      <CosmosSectionHeader title="Próximos pagamentos" style={{ marginBottom: 12 }} />

      {upcoming.map(p => {
        const due         = p.computedNextDue;
        const dc          = dueClass(due);
        const monthKey    = getRecurringMonthKey(due);
        const isPast      = due <= today;
        const isConfirmed = isConfirmedForMonth(p.id, monthKey, confirmedRecurring);
        const isPending   = isPast && !isConfirmed;

        return (
          <div key={p.id} className={`hrp-row${isPending ? ' hrp-row--pending' : ''}`}>
            <CategoryIconBubble name={catLabel(p)} type="expense" size={30} radius="8px" />
            <div className="hrp-body">
              <div className="hrp-title">
                {p.title}
                {isPending   && <span className="hrp-pending-badge">por confirmar</span>}
                {isConfirmed && <span className="hrp-confirmed-badge">✓ pago</span>}
              </div>
              <div className="hrp-sub">{catLabel(p) || '—'}</div>
            </div>
            <div className="hrp-right">
              <div className="hrp-amount">
                {p.paymentType === 'variable' && p.estimatedAmount
                  ? `~${safeNum(p.estimatedAmount).toFixed(2)}€`
                  : `${safeNum(p.amount).toFixed(2)}€`}
              </div>
              <div className={`hrp-due${dc ? ` ${dc}` : ''}`}>{relativeDueDate(due)}</div>
            </div>
          </div>
        );
      })}

    </CosmosCard>
  );
};

export default HomeRecurring;
