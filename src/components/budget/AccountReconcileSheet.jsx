/**
 * AccountReconcileSheet — "conferir saldo" de uma conta.
 *
 * O utilizador diz o saldo REAL e a data; a app mostra a diferença face ao saldo
 * que calcula. Depois ajuda a LOCALIZAR o que falta: lista as recorrentes
 * previstas e não casadas no período (candidatas), que podem ser adicionadas
 * (cria + liga, sem duplicar). O gap restante pode ser ajustado num toque
 * explícito (campo adjustment), como rede de segurança. No fim, a conta fica
 * "conferida até [data] ✓".
 */
import React, { useState, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, Plus } from 'lucide-react';
import CosmosSheet from '../cosmos/CosmosSheet';
import { reconcileAccount, findGapCandidates } from '../../utils/reconciliation';
import { roundCents } from '../../utils/budgetUtils';
import { shortDate, getRecurringMonthKey } from '../../utils/recurringPayments';
import './AccountReconcileSheet.css';

const todayStr = () => new Date().toISOString().split('T')[0];
const eur = (n) => `${(Math.round((n || 0) * 100) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;

export default function AccountReconcileSheet({
  open,
  onClose,
  account,
  transactions = [],
  recurringPayments = [],
  confirmedRecurring = {},
  onConfirmRecurring,   // ({ recurringPayment, dueDate, monthKey, amount, accountId }) => Promise
  onSaveAccount,        // (accountId, patch) => void  — persiste reconciledAt/reconciledBalance/adjustment
  prefillBalance = null, // saldo final do extrato (pré-preenche o campo)
  prefillDate = null,    // data do último movimento do extrato
}) {
  const [asOf, setAsOf]   = useState(prefillDate || todayStr());
  const [real, setReal]   = useState(prefillBalance != null ? String(prefillBalance) : '');
  const [busyId, setBusyId] = useState(null);

  // Período onde procurar o que falta: da última conferência (ou criação) até à data conferida.
  const fromDate = useMemo(() => {
    if (account?.reconciledAt) return account.reconciledAt;
    if (account?.insertedAt)   return String(account.insertedAt).slice(0, 10);
    // Fallback: 6 meses antes da data conferida.
    const d = new Date(asOf + 'T00:00:00');
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split('T')[0];
  }, [account, asOf]);

  const hasReal = real.trim() !== '' && Number.isFinite(Number(real));

  const recon = useMemo(() => {
    if (!account || !hasReal) return null;
    return reconcileAccount({ account, transactions, realBalance: Number(real), asOfDate: asOf });
  }, [account, transactions, real, asOf, hasReal]);

  const candidates = useMemo(() => {
    if (!account || !recon || recon.direction !== 'missing-expense') return [];
    return findGapCandidates({
      recurringPayments,
      transactions,
      accountId: account.id,
      fromDate,
      toDate: asOf,
      confirmedRecurring,
    });
  }, [account, recon, recurringPayments, transactions, fromDate, asOf, confirmedRecurring]);

  if (!account) return null;

  const gap = recon?.gap ?? 0;
  const isOk = recon && recon.direction === 'ok';

  const handleAddCandidate = async (c) => {
    if (!onConfirmRecurring || busyId) return;
    setBusyId(`${c.payment.id}_${c.dueDate}`);
    try {
      await onConfirmRecurring({
        recurringPayment: c.payment,
        dueDate: c.dueDate,
        monthKey: c.monthKey || getRecurringMonthKey(c.dueDate),
        amount: c.amount,
        accountId: account.id,
      });
    } finally {
      setBusyId(null);
    }
    // As transações vêm por prop do App → o gap e a lista recalculam sozinhos.
  };

  const handleAdjustAndMark = () => {
    const currentAdj = Number(account.adjustment) || 0;
    onSaveAccount?.(account.id, {
      adjustment: roundCents(currentAdj + gap),  // fecha o gap restante (a cêntimos)
      reconciledAt: asOf,
      reconciledBalance: roundCents(Number(real)),
    });
    onClose?.();
  };

  const handleMarkOnly = () => {
    onSaveAccount?.(account.id, { reconciledAt: asOf, reconciledBalance: roundCents(Number(real)) });
    onClose?.();
  };

  return (
    <CosmosSheet open={open} onClose={onClose} title="Conferir saldo">
      <div className="ars-root">
        <div className="ars-acc">{account.name}{account.bank ? ` · ${account.bank}` : ''}</div>
        {account.reconciledAt && (
          <div className="ars-prev">Última conferência: {shortDate(account.reconciledAt)}</div>
        )}

        {/* Inputs */}
        <div className="ars-field">
          <label className="ars-label">Saldo real da conta (€)</label>
          <input
            className="ars-input"
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={real}
            onChange={e => setReal(e.target.value)}
            step="0.01"
            autoFocus
          />
        </div>
        <div className="ars-field">
          <label className="ars-label">À data de</label>
          <input
            className="ars-input"
            type="date"
            value={asOf}
            max={todayStr()}
            onChange={e => setAsOf(e.target.value)}
          />
        </div>

        {/* Comparação */}
        {recon && (
          <div className="ars-compare">
            <div className="ars-compare-row">
              <span>Saldo calculado pela app</span>
              <strong>{eur(recon.computed)}</strong>
            </div>
            <div className="ars-compare-row">
              <span>Saldo real declarado</span>
              <strong>{eur(recon.real)}</strong>
            </div>
            <div className={`ars-gap ${isOk ? 'ok' : 'diff'}`}>
              {isOk ? (
                <><CheckCircle2 size={16} /> Saldos coincidem</>
              ) : (
                <>
                  <AlertTriangle size={16} />
                  Diferença de {eur(Math.abs(gap))}
                  {recon.direction === 'missing-expense'
                    ? ' — podem faltar despesas'
                    : ' — podem faltar receitas'}
                </>
              )}
            </div>
          </div>
        )}

        {/* Candidatos (recorrentes previstas não casadas) */}
        {candidates.length > 0 && (
          <div className="ars-cands">
            <div className="ars-cands-title">Pode ser um destes pagamentos previstos:</div>
            {candidates.map(c => {
              const id = `${c.payment.id}_${c.dueDate}`;
              return (
                <div key={id} className="ars-cand-row">
                  <div className="ars-cand-body">
                    <span className="ars-cand-title">{c.payment.title}</span>
                    <span className="ars-cand-meta">
                      previsto {shortDate(c.dueDate)}
                      {c.paymentType === 'variable' ? ' · variável' : ''}
                    </span>
                  </div>
                  <span className="ars-cand-amt">{eur(c.amount)}</span>
                  <button
                    className="ars-cand-add"
                    onClick={() => handleAddCandidate(c)}
                    disabled={!!busyId}
                  >
                    {busyId === id ? '…' : <><Plus size={13} /> Adicionar</>}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Ações finais */}
        {recon && (
          <div className="ars-actions">
            {isOk ? (
              <button className="ars-btn ars-btn--ok" onClick={handleMarkOnly}>
                Marcar como conferida ✓
              </button>
            ) : (
              <>
                <button className="ars-btn ars-btn--adjust" onClick={handleAdjustAndMark}>
                  Ajustar saldo ({eur(gap)}) e marcar conferida
                </button>
                <div className="ars-hint">
                  O ajuste corrige o saldo sem criar transações — usa-o só para o que sobrar depois de adicionar os pagamentos em falta.
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </CosmosSheet>
  );
}
