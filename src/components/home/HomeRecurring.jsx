import React, { useMemo } from 'react';
import { getUpcomingPayments, relativeDueDate, safeNum } from '../../utils/recurringPayments';
import { CategoryIconBubble } from '../../utils/categoryIcons';
import '../budget/Recurring.css';

const HomeRecurring = ({ recurringPayments, categories }) => {
  const expCats = categories?.expense || [];

  const upcoming = useMemo(
    () => getUpcomingPayments(recurringPayments, 5),
    [recurringPayments],
  );

  if (!upcoming.length) return null;

  const catLabel = (p) =>
    expCats.find(c => c.id === p.categoryId)?.label || '';

  const dueClass = (due) => {
    const today = new Date().toISOString().split('T')[0];
    if (due === today) return 'today';
    const diff = Math.round(
      (new Date(due + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000,
    );
    if (diff <= 1) return 'urgent';
    if (diff <= 5) return 'soon';
    return '';
  };

  return (
    <div className="h-card hrp-card">
      <div className="h-section-title">Próximos pagamentos</div>
      {upcoming.map(p => {
        const due = p.computedNextDue;
        const dc  = dueClass(due);
        return (
          <div key={p.id} className="hrp-row">
            <CategoryIconBubble name={catLabel(p)} type="expense" size={30} radius="8px" />
            <div className="hrp-body">
              <div className="hrp-title">{p.title}</div>
              <div className="hrp-sub">{catLabel(p) || '—'}</div>
            </div>
            <div className="hrp-right">
              <div className="hrp-amount">{safeNum(p.amount).toFixed(2)}€</div>
              <div className={`hrp-due${dc ? ` ${dc}` : ''}`}>{relativeDueDate(due)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HomeRecurring;
