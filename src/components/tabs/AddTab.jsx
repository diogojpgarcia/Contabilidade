import React, { useState } from 'react';
import { CategoryIconBubble } from '../../utils/categoryIcons';
import CategoryPicker from '../CategoryPicker';
import { Tag, CreditCard, FileText, Calendar, ArrowUp, ArrowDown, Target, Minus, Plus, ArrowLeftRight } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import './AddTab.css';

/**
 * AddTab — formulário de adição de transações.
 *
 * Props:
 *   onTransactionAdded — (transaction) => Promise
 *   onTransfer         — (fromId, toId, amount) => Promise
 *   patrimony          — objeto patrimony com accounts[]
 *   defaultAccount     — conta pré-selecionada
 *   goals              — array de objetivos (vem do useSettings via App.jsx)
 *   onGoalsChange      — (updatedGoals) => void  (persiste e atualiza estado global)
 */
const AddTab = ({ onTransactionAdded, onTransfer, patrimony, defaultAccount, goals = [], onGoalsChange }) => {
  const { currentUser, categories } = useAppContext();
  const { showError, showWarning } = useToast();
  const [type, setType]             = useState('expense');
  const [amount, setAmount]         = useState('');
  const [category, setCategory]     = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate]             = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading]       = useState(false);
  const [selectedGoal,     setSelectedGoal]     = useState('');
  const [goalAccountId,    setGoalAccountId]    = useState('');
  const [goalAccountName,  setGoalAccountName]  = useState('');
  const [transferFrom, setTransferFrom]         = useState('');
  const [transferTo,   setTransferTo]           = useState('');
  const [accountId,    setAccountId]            = useState(defaultAccount?.id   || '');
  const [accountName,  setAccountName]          = useState(defaultAccount?.name || '');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const accounts = (patrimony?.accounts || []);

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();

    if (!amount) { showWarning('Preenche o valor.'); return; }
    if (type === 'goal' && !selectedGoal) { showWarning('Seleciona um objetivo.'); return; }
    if (type !== 'goal' && type !== 'transfer' && !category) { showWarning('Seleciona uma categoria.'); return; }
    if (type === 'transfer' && (!transferFrom || !transferTo)) { showWarning('Seleciona origem e destino.'); return; }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) { showWarning('Valor inválido.'); return; }

    if (type === 'transfer') {
      const fromAcc = accounts.find(a => a.id === transferFrom);
      const liveBal = parseFloat(fromAcc?.currentBalance ?? fromAcc?.balance) || 0;
      if (fromAcc && amountValue > liveBal) {
        showWarning(`Saldo insuficiente. Disponível: ${liveBal.toFixed(2)}€`);
        return;
      }
    }

    setLoading(true);
    try {
      if (type === 'transfer') {
        if (onTransfer) await onTransfer(transferFrom, transferTo, amountValue);
        setAmount(''); setTransferFrom(''); setTransferTo('');
        setDate(new Date().toISOString().split('T')[0]);
      } else if (type === 'goal') {
        // Actualizar progresso do objetivo
        const updatedGoals = goals.map(g =>
          g.id === selectedGoal ? { ...g, currentSavings: (g.currentSavings || 0) + amountValue } : g
        );
        onGoalsChange?.(updatedGoals);
        // Criar transação de despesa ligada à conta escolhida
        const goalName = goals.find(g => g.id === selectedGoal)?.name || 'Objetivo';
        if (onTransactionAdded) {
          await onTransactionAdded({
            type:         'expense',
            amount:       amountValue,
            category:     'Objetivos',
            description:  `Para objetivo: ${goalName}`,
            date,
            account_id:   goalAccountId   || null,
            account_name: goalAccountName || null,
          });
        }
      } else {
        const transaction = {
          type, amount: amountValue, category,
          description: description.trim() || null, date,
          account_id:   accountId   || null,
          account_name: accountName || null,
        };
        if (onTransactionAdded) await onTransactionAdded(transaction);
      }
      if (type !== 'transfer') {
        setAmount(''); setCategory(''); setSelectedGoal(''); setGoalAccountId(''); setGoalAccountName(''); setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        // Account selection preserved — user usually pays from the same account
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Erro ao adicionar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const switchType = (newType) => {
    setType(newType);
    setCategory(''); setSelectedGoal(''); setGoalAccountId(''); setGoalAccountName(''); setTransferFrom(''); setTransferTo('');
  };

  const handleAccountSelect = (e) => {
    const id = e.target.value;
    const acc = accounts.find(a => a.id === id);
    setAccountId(id);
    setAccountName(acc?.name || '');
  };

  const typeConfig = {
    expense:  { label: 'Despesa',       sub: 'Regista uma despesa',        cta: 'Adicionar Despesa',         ico: <Minus size={18} strokeWidth={2} /> },
    income:   { label: 'Receita',        sub: 'Regista uma receita',         cta: 'Adicionar Receita',          ico: <Plus size={18} strokeWidth={2} /> },
    transfer: { label: 'Transferência',  sub: 'Transfere entre contas',      cta: 'Confirmar Transferência',    ico: <ArrowLeftRight size={16} strokeWidth={1.75} /> },
    goal:     { label: 'Objetivo',       sub: 'Contribui para um objetivo',  cta: 'Guardar para Objetivo',      ico: <Target size={16} strokeWidth={1.75} /> },
  };
  const cfg = typeConfig[type];

  return (
    <div className="cosmos-add">

      {/* Header */}
      <div className="cosmos-add-header">
        <div className="cosmos-add-title">Adicionar</div>
        <div className="cosmos-add-subtitle">{cfg.sub}</div>
      </div>

      {/* Type chips */}
      <div className="cosmos-type-row">
        {['expense','income','transfer','goal'].map(t => (
          <button
            key={t}
            type="button"
            className={`cosmos-type-btn${type === t ? ` sel-${t}` : ''}`}
            onClick={() => switchType(t)}
          >
            <span className="cta-ico">{typeConfig[t].ico}</span>
            <span className="cta-lbl">{typeConfig[t].label}</span>
          </button>
        ))}
      </div>

      {/* Amount */}
      <div className="cosmos-amount-zone">
        <input
          className={`cosmos-amount-display ${type}`}
          type="number"
          inputMode="decimal"
          placeholder="0,00"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="cosmos-amount-hint">€</div>
      </div>

      {/* Fields card */}
      <div className="cosmos-fields">

        {/* Transfer: From + To */}
        {type === 'transfer' && (<>
          <div className="cosmos-field-row">
            <div className="cosmos-field-ico" style={{ background: 'var(--cosmos-accent-dim)' }}><ArrowUp size={16} strokeWidth={1.75} color="var(--cosmos-accent)" /></div>
            <div className="cosmos-field-inner">
              <div className="cosmos-field-label">De</div>
              {accounts.length === 0
                ? <span style={{ fontSize: 13, color: '#334155' }}>Sem contas — adiciona em Budget</span>
                : <select className="cosmos-field-select" value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)}>
                    <option value="">Conta de origem</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` · ${a.bank}` : ''} — {(parseFloat(a.currentBalance ?? a.balance) || 0).toFixed(2)}€</option>)}
                  </select>}
            </div>
          </div>
          <div className="cosmos-field-row">
            <div className="cosmos-field-ico" style={{ background: 'var(--cosmos-accent-dim)' }}><ArrowDown size={16} strokeWidth={1.75} color="var(--cosmos-accent)" /></div>
            <div className="cosmos-field-inner">
              <div className="cosmos-field-label">Para</div>
              {accounts.length === 0
                ? <span style={{ fontSize: 13, color: '#334155' }}>Sem contas — adiciona em Budget</span>
                : <select className="cosmos-field-select" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                    <option value="">Conta de destino</option>
                    {accounts.filter(a => a.id !== transferFrom).map(a => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` · ${a.bank}` : ''}</option>)}
                  </select>}
            </div>
          </div>
        </>)}

        {/* Expense / Income: Category */}
        {(type === 'expense' || type === 'income') && (
          <div className="cosmos-field-row">
            <div className="cosmos-field-ico" style={{ background: 'rgba(255,255,255,0.06)' }}><Tag size={16} strokeWidth={1.75} color="#94A3B8" /></div>
            <div className="cosmos-field-inner">
              <div className="cosmos-field-label">Categoria</div>
              <button type="button" className="cosmos-field-cat-btn" onClick={() => setShowCategoryPicker(true)}>
                {category
                  ? <><CategoryIconBubble name={category} type={type} size={22} radius="6px" /><span className="cosmos-field-cat-text">{category}</span></>
                  : <span className="cosmos-field-cat-text ph">Seleciona uma categoria</span>}
              </button>
            </div>
            <span className="cosmos-field-chevron">›</span>
            {showCategoryPicker && (
              <CategoryPicker
                transaction={{ id: null, type, category, description }}
                categories={categories}
                title="Selecionar Categoria"
                onSelect={(label) => { setCategory(label); setShowCategoryPicker(false); }}
                onClose={() => setShowCategoryPicker(false)}
              />
            )}
          </div>
        )}

        {/* Goal: Goal selector */}
        {type === 'goal' && (
          <div className="cosmos-field-row">
            <div className="cosmos-field-ico" style={{ background: 'rgba(251,191,36,0.10)' }}><Target size={16} strokeWidth={1.75} color="#FBBF24" /></div>
            <div className="cosmos-field-inner">
              <div className="cosmos-field-label">Objetivo</div>
              {goals.length === 0
                ? <span style={{ fontSize: 13, color: '#334155' }}>Sem objetivos — cria um em Budget</span>
                : <select className="cosmos-field-select" value={selectedGoal} onChange={(e) => setSelectedGoal(e.target.value)}>
                    <option value="">Seleciona um objetivo</option>
                    {goals.map(g => <option key={g.id} value={g.id}>{g.name} ({(g.currentSavings || 0).toFixed(2)}€ / {g.amount.toFixed(2)}€)</option>)}
                  </select>}
            </div>
          </div>
        )}

        {/* Goal: Account selector */}
        {type === 'goal' && (
          <div className="cosmos-field-row">
            <div className="cosmos-field-ico" style={{ background: 'rgba(255,255,255,0.06)' }}><CreditCard size={16} strokeWidth={1.75} color="#94A3B8" /></div>
            <div className="cosmos-field-inner">
              <div className="cosmos-field-label">Conta (de onde sai)</div>
              {accounts.length === 0
                ? <span style={{ fontSize: 13, color: '#334155' }}>Sem contas</span>
                : <select
                    className="cosmos-field-select"
                    value={goalAccountId}
                    onChange={e => {
                      const id = e.target.value;
                      const acc = accounts.find(a => a.id === id);
                      setGoalAccountId(id);
                      setGoalAccountName(acc?.name || '');
                    }}
                  >
                    <option value="">Sem conta específica</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` · ${a.bank}` : ''} — {(parseFloat(a.currentBalance ?? a.balance) || 0).toFixed(2)}€</option>)}
                  </select>}
            </div>
          </div>
        )}

        {/* Account — expense/income only */}
        {(type === 'expense' || type === 'income') && (
          <div className="cosmos-field-row">
            <div className="cosmos-field-ico" style={{ background: 'rgba(255,255,255,0.06)' }}><CreditCard size={16} strokeWidth={1.75} color="#94A3B8" /></div>
            <div className="cosmos-field-inner">
              <div className="cosmos-field-label">Conta</div>
              {accounts.length === 0
                ? <span style={{ fontSize: 13, color: '#334155' }}>Sem contas</span>
                : <select className="cosmos-field-select" value={accountId} onChange={handleAccountSelect}>
                    <option value="">Sem conta específica</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` · ${a.bank}` : ''} — {(parseFloat(a.currentBalance ?? a.balance) || 0).toFixed(2)}€</option>)}
                  </select>}
            </div>
          </div>
        )}

        {/* Description / Note — all types */}
        <div className="cosmos-field-row">
          <div className="cosmos-field-ico" style={{ background: 'rgba(255,255,255,0.06)' }}><FileText size={16} strokeWidth={1.75} color="#94A3B8" /></div>
          <div className="cosmos-field-inner">
            <div className="cosmos-field-label">{type === 'transfer' || type === 'goal' ? 'Nota' : 'Descrição'} (opcional)</div>
            <input
              type="text"
              className="cosmos-field-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adiciona uma nota..."
              maxLength={100}
            />
          </div>
        </div>

        {/* Date — all types */}
        <div className="cosmos-field-row">
          <div className="cosmos-field-ico" style={{ background: 'rgba(255,255,255,0.06)' }}><Calendar size={16} strokeWidth={1.75} color="#94A3B8" /></div>
          <div className="cosmos-field-inner">
            <div className="cosmos-field-label">Data</div>
            <input
              type="date"
              className="cosmos-field-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

      </div>

      {/* CTA */}
      <button
        className={`cosmos-cta ${type}`}
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? 'A guardar…' : `✓ ${cfg.cta}`}
      </button>

    </div>
  );
};

export default AddTab;
