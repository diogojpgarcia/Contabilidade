import React from 'react';
import './CosmosTransactionRow.css';

/**
 * CosmosTransactionRow — universal transaction row.
 *
 * icon      : emoji string or React node
 * iconBg    : CSS background for the icon bubble (e.g. 'rgba(234,88,12,0.14)')
 * title     : primary label
 * category  : contextual meta text (category name, description, etc.)
 * amount    : formatted string (e.g. '−45,00 €') or number
 * positive  : true = income color · false = expense color · undefined = neutral
 * account   : optional account label string
 * recurring : optional recurring label — true shows 'Recorrente', string shows it
 * onClick   : tap handler
 */
export default function CosmosTransactionRow({
  icon,
  iconBg,
  iconColor,
  title,
  category,
  amount,
  positive,
  account,
  recurring,
  onClick,
  className = '',
}) {
  const amountClass =
    positive === true  ? 'ctr__amount--positive' :
    positive === false ? 'ctr__amount--negative' :
                         'ctr__amount--neutral';

  const formattedAmount =
    typeof amount === 'number'
      ? (positive === false ? '−' : positive === true ? '+' : '') +
        (Math.abs(parseFloat(amount)) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
      : amount;

  const recurringLabel =
    recurring === true ? 'Recorrente' :
    typeof recurring === 'string' ? recurring :
    null;

  return (
    <div className={`ctr ${className}`} onClick={onClick}>
      {/* Icon bubble */}
      <div
        className="ctr__icon"
        style={{
          background: iconBg || 'rgba(160, 170, 187, 0.10)',
          color: iconColor || 'var(--cosmos-text-2)',
        }}
      >
        {icon}
      </div>

      {/* Body */}
      <div className="ctr__body">
        <span className="ctr__title">{title}</span>
        <div className="ctr__meta">
          {category && <span className="ctr__category">{category}</span>}
          {account && (
            <span className="ctr__label ctr__label--account">{account}</span>
          )}
          {recurringLabel && (
            <span className="ctr__label ctr__label--recurring">{recurringLabel}</span>
          )}
        </div>
      </div>

      {/* Amount */}
      {amount !== undefined && amount !== null && (
        <span className={`ctr__amount ${amountClass}`}>{formattedAmount}</span>
      )}
    </div>
  );
}
