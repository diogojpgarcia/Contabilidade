import React from 'react';
import Overlay from './Overlay';
import './AccountPicker.css';

/**
 * AccountPicker — bottom sheet for linking a transaction to a patrimony account.
 *
 * Props:
 *   accounts        patrimony.accounts array
 *   currentAccountId  id of the currently linked account (or null)
 *   onSelect(id, name)  called with the chosen account; id=null means "no account"
 *   onClose()
 */
const AccountPicker = ({ accounts, currentAccountId, onSelect, onClose }) => (
  <Overlay onClose={onClose}>
    <div className="ap-sheet" onClick={e => e.stopPropagation()}>
      <div className="ap-handle" />

      <div className="ap-header">
        <span className="ap-title">Selecionar Conta</span>
        <button className="ap-close" onClick={onClose}>&#215;</button>
      </div>

      <div className="ap-list">
        {/* "No account" option */}
        <button
          className={`ap-item${!currentAccountId ? ' ap-item--active' : ''}`}
          onClick={() => { onSelect(null, null); onClose(); }}
        >
          <span className="ap-item-icon">○</span>
          <span className="ap-item-label">Sem conta específica</span>
          {!currentAccountId && <span className="ap-item-check">✓</span>}
        </button>

        {accounts.map(acc => {
          const isActive = acc.id === currentAccountId;
          const bal = (parseFloat(acc.currentBalance ?? acc.balance) || 0).toFixed(2);
          return (
            <button
              key={acc.id}
              className={`ap-item${isActive ? ' ap-item--active' : ''}`}
              onClick={() => { onSelect(acc.id, acc.name); onClose(); }}
            >
              <span className="ap-item-icon">◈</span>
              <div className="ap-item-body">
                <span className="ap-item-label">
                  {acc.name}{acc.bank ? ` · ${acc.bank}` : ''}
                </span>
                <span className="ap-item-balance">{bal}€</span>
              </div>
              {isActive && <span className="ap-item-check">✓</span>}
            </button>
          );
        })}

        {accounts.length === 0 && (
          <p className="ap-empty">Sem contas. Adiciona em Budget → Património.</p>
        )}
      </div>
    </div>
  </Overlay>
);

export default AccountPicker;
