import React, { useState, useEffect } from 'react';
import { dbService } from '../../lib/supabase';
import { CategoryIconBubble } from '../../utils/categoryIcons';
import CategoryPicker from '../CategoryPicker';
import { Tag, CreditCard, FileText, Calendar, ArrowUp, ArrowDown, Target, Minus, Plus, ArrowLeftRight } from 'lucide-react';
import './AddTab.css';

const AddTab = ({ user, categories, onTransactionAdded, onTransfer, patrimony, defaultAccount, theme = 'default' }) => {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [goals, setGoals] = useState([]);
  const [selectedGoal, setSelectedGoal] = useState('');
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo]     = useState('');
  const [accountId,   setAccountId]     = useState(defaultAccount?.id   || '');
  const [accountName, setAccountName]   = useState(defaultAccount?.name || '');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const accounts = (patrimony?.accounts || []);

  useEffect(() => { loadGoals(); }, [user]);

  const loadGoals = async () => {
    try {
      const settings = await dbService.getUserSettings(user.id);
      if (settings?.goals) setGoals(settings.goals);
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  const currentCategories = type === 'expense' ? categories.expense : categories.income;

  const getCategoryIcon = (categoryName) => {
    const iconMap = {
      'Alimentação':'⚑','Habitação':'⌂','Transporte':'⚐','Saúde':'✚','Lazer':'◉',
      'Educação':'⊞','Roupa':'◫','Tecnologia':'◧','Subscrições':'◉','Outros':'◌',
      'Salário':'◈','Freelance':'◐','Investimentos':'◭','Bonus':'◆','Outros Rendimentos':'◌'
    };
    return iconMap[categoryName] || '◌';
  };

  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();

    if (!amount) { alert('Preenche o valor!'); return; }
    if (type === 'goal' && !selectedGoal) { alert('Seleciona um objetivo!'); return; }
    if (type !== 'goal' && type !== 'transfer' && !category) { alert('Seleciona uma categoria!'); return; }
    if (type === 'transfer' && (!transferFrom || !transferTo)) { alert('Seleciona origem e destino!'); return; }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) { alert('Valor inválido!'); return; }

    if (type === 'transfer') {
      const fromAcc = accounts.find(a => a.id === transferFrom);
      if (fromAcc && amountValue > (parseFloat(fromAcc.balance) || 0)) {
        alert(`Saldo insuficiente. Disponível: ${(parseFloat(fromAcc.balance) || 0).toFixed(2)}€`);
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
        const updatedGoals = goals.map(g =>
          g.id === selectedGoal ? { ...g, currentSavings: (g.currentSavings || 0) + amountValue } : g
        );
        await dbService.updateUserSettings(user.id, { goals: updatedGoals });
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
        setAmount(''); setCategory(''); setSelectedGoal(''); setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        // Preserve account selection — user usually pays from the same account
        loadGoals();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('✕ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const switchType = (newType) => {
    setType(newType);
    setCategory(''); setSelectedGoal(''); setTransferFrom(''); setTransferTo('');
  };

  const handleAccountSelect = (e) => {
    const id = e.target.value;
    const acc = accounts.find(a => a.id === id);
    setAccountId(id);
    setAccountName(acc?.name || '');
  };

  /* ── Shared form fields (rendered in both branches) ─────────────────────── */
  const formFields = (
    <>
      {/* Type toggle */}
      <div className={theme === 'default' ? 'type-toggle' : 'm-toggle'} style={theme !== 'default' ? { margin: '0 0 2px' } : {}}>
        {theme === 'default' ? (
          <>
            <button type="button" className={`type-btn ${type === 'expense' ? 'active expense' : ''}`} onClick={() => switchType('expense')}><span className="type-icon-sf">−</span><span>Despesa</span></button>
            <button type="button" className={`type-btn ${type === 'income' ? 'active income' : ''}`} onClick={() => switchType('income')}><span className="type-icon-sf">+</span><span>Receita</span></button>
            <button type="button" className={`type-btn ${type === 'transfer' ? 'active transfer' : ''}`} onClick={() => switchType('transfer')}><span className="type-icon-sf">↕</span><span>Transferência</span></button>
            <button type="button" className={`type-btn ${type === 'goal' ? 'active goal' : ''}`} onClick={() => switchType('goal')}><span className="type-icon-sf">◆</span><span>Objetivos</span></button>
          </>
        ) : (
          <>
            <button className={`m-toggle-btn ${type === 'expense'  ? 'active' : ''}`} onClick={() => switchType('expense')}>− Despesa</button>
            <button className={`m-toggle-btn ${type === 'income'   ? 'active' : ''}`} onClick={() => switchType('income')}>+ Receita</button>
            <button className={`m-toggle-btn ${type === 'transfer' ? 'active' : ''}`} onClick={() => switchType('transfer')}>↕ Transferência</button>
            <button className={`m-toggle-btn ${type === 'goal'     ? 'active' : ''}`} onClick={() => switchType('goal')}>◆ Objetivo</button>
          </>
        )}
      </div>

      {/* Amount */}
      {theme === 'default' ? (
        <div className="form-field">
          <label>Valor</label>
          <div className="amount-input">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" step="0.01" min="0" inputMode="decimal" />
            <span className="currency">€</span>
          </div>
        </div>
      ) : (
        <div className="m-amount-field">
          <input type="number" className="m-amount-input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" step="0.01" min="0" inputMode="decimal" />
          <span className="m-currency">€</span>
        </div>
      )}

      {/* Transfer fields */}
      {type === 'transfer' && (theme === 'default' ? (
        <>
          <div className="form-field">
            <label>Conta de origem</label>
            {accounts.length === 0
              ? <p className="helper-text">Sem contas. Adiciona uma em Budget → Património.</p>
              : <select value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)} className="category-select">
                  <option value="">Seleciona conta de origem</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` · ${a.bank}` : ''} — {(parseFloat(a.currentBalance ?? a.balance) || 0).toFixed(2)}€</option>)}
                </select>}
          </div>
          <div className="form-field">
            <label>Conta de destino</label>
            {accounts.length > 0 &&
              <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className="category-select">
                <option value="">Seleciona conta de destino</option>
                {accounts.filter(a => a.id !== transferFrom).map(a => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` · ${a.bank}` : ''}</option>)}
              </select>}
          </div>
        </>
      ) : (
        <>
          <div className="m-field-card">
            <span className="m-field-label">Conta de origem</span>
            {accounts.length === 0
              ? <span className="m-helper">Sem contas. Adiciona uma em Budget → Património.</span>
              : <select className="m-field-select" value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)}>
                  <option value="">Seleciona conta de origem</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` · ${a.bank}` : ''} — {(parseFloat(a.currentBalance ?? a.balance) || 0).toFixed(2)}€</option>)}
                </select>}
          </div>
          <div className="m-field-card">
            <span className="m-field-label">Conta de destino</span>
            {accounts.length > 0 &&
              <select className="m-field-select" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                <option value="">Seleciona conta de destino</option>
                {accounts.filter(a => a.id !== transferFrom).map(a => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` · ${a.bank}` : ''}</option>)}
              </select>}
          </div>
        </>
      ))}

      {/* Category / Goal */}
      {type !== 'transfer' && (theme === 'default' ? (
        type === 'goal' ? (
          <div className="form-field">
            <label>Objetivo</label>
            <select value={selectedGoal} onChange={(e) => setSelectedGoal(e.target.value)} className="category-select">
              <option value="">Seleciona um objetivo</option>
              {goals.map(g => <option key={g.id} value={g.id}>◆ {g.name} ({g.currentSavings?.toFixed(0) || 0}€ / {g.amount.toFixed(0)}€)</option>)}
            </select>
            {goals.length === 0 && <p className="helper-text">Sem objetivos. Cria um em Budget → Objetivos</p>}
          </div>
        ) : (
          <div className="form-field">
            <label>Categoria</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="category-select">
              <option value="">Seleciona uma categoria</option>
              {currentCategories.map(cat => <option key={cat.id} value={cat.label}>{getCategoryIcon(cat.label)} {cat.label}</option>)}
            </select>
          </div>
        )
      ) : (
        type === 'goal' ? (
          <div className="m-field-card">
            <span className="m-field-label">Objetivo</span>
            <select className="m-field-select" value={selectedGoal} onChange={(e) => setSelectedGoal(e.target.value)}>
              <option value="">Seleciona um objetivo</option>
              {goals.map(g => <option key={g.id} value={g.id}>◆ {g.name} ({g.currentSavings?.toFixed(0) || 0}€ / {g.amount.toFixed(0)}€)</option>)}
            </select>
            {goals.length === 0 && <span className="m-helper">Sem objetivos. Cria um em Budget → Objetivos</span>}
          </div>
        ) : (
          <div className="m-field-card">
            <span className="m-field-label">Categoria</span>
            <button
              type="button"
              className="m-field-cat-btn"
              onClick={() => setShowCategoryPicker(true)}
            >
              {category ? (
                <>
                  <CategoryIconBubble name={category} type={type} size={28} radius="7px" />
                  <span className="m-field-cat-label">{category}</span>
                </>
              ) : (
                <span className="m-field-cat-placeholder">Seleciona uma categoria</span>
              )}
              <span className="m-field-cat-chevron">›</span>
            </button>
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
        )
      ))}

      {/* Description */}
      {theme === 'default' ? (
        <div className="form-field">
          <label>Descrição (opcional)</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Compras supermercado" maxLength={100} className="text-input" />
        </div>
      ) : (
        <div className="m-field-card">
          <span className="m-field-label">Descrição (opcional)</span>
          <input type="text" className="m-field-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Compras supermercado" maxLength={100} />
        </div>
      )}

      {/* Account — expense/income only (transfer already has from/to selectors) */}
      {type !== 'transfer' && type !== 'goal' && (theme === 'default' ? (
        <div className="form-field">
          <label>Conta</label>
          {accounts.length === 0
            ? <p className="helper-text">Sem contas. Adiciona em Budget → Património.</p>
            : <select value={accountId} onChange={handleAccountSelect} className="category-select">
                <option value="">Sem conta específica</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.bank ? ` · ${a.bank}` : ''} — {(parseFloat(a.currentBalance ?? a.balance) || 0).toFixed(0)}€
                  </option>
                ))}
              </select>}
        </div>
      ) : (
        <div className="m-field-card">
          <span className="m-field-label">Conta</span>
          {accounts.length === 0
            ? <span className="m-helper">Sem contas. Adiciona em Budget → Património.</span>
            : <select className="m-field-select" value={accountId} onChange={handleAccountSelect}>
                <option value="">Sem conta específica</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.bank ? ` · ${a.bank}` : ''} — {(parseFloat(a.currentBalance ?? a.balance) || 0).toFixed(0)}€
                  </option>
                ))}
              </select>}
        </div>
      ))}

      {/* Date */}
      {theme === 'default' ? (
        <div className="form-field">
          <label>Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().split('T')[0]} className="date-input" />
        </div>
      ) : (
        <div className="m-field-card">
          <span className="m-field-label">Data</span>
          <input type="date" className="m-field-input" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().split('T')[0]} />
        </div>
      )}
    </>
  );

  /* ── MODERN / FINTECH BRANCH ─────────────────────────────────────────────
     Layout: flex column — scrollable body on top, sticky footer on bottom.
     No height:100vh, no overflow:hidden on this element.                   */
  if (theme === 'modern' || theme === 'fintech') {
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

        {/* Fields card */}
        <div className="cosmos-fields">

          {/* Transfer: From + To */}
          {type === 'transfer' && (<>
            <div className="cosmos-field-row">
              <div className="cosmos-field-ico" style={{ background: 'rgba(0,221,255,0.10)' }}><ArrowUp size={16} strokeWidth={1.75} color="#00DDFF" /></div>
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
              <div className="cosmos-field-ico" style={{ background: 'rgba(0,221,255,0.10)' }}><ArrowDown size={16} strokeWidth={1.75} color="#00DDFF" /></div>
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
                      {goals.map(g => <option key={g.id} value={g.id}>{g.name} ({(g.currentSavings || 0).toFixed(0)}€ / {g.amount.toFixed(0)}€)</option>)}
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
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.bank ? ` · ${a.bank}` : ''} — {(parseFloat(a.currentBalance ?? a.balance) || 0).toFixed(0)}€</option>)}
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
  }

  /* ── DEFAULT BRANCH ──────────────────────────────────────────────────── */
  return (
    <div className="add-tab">
      <div className="add-header">
        <h2>Nova Transação</h2>
        <p>Adiciona receitas ou despesas</p>
      </div>

      {/* Scrollable form body */}
      <div className="add-form-container">
        {formFields}
      </div>

      {/* Sticky submit button */}
      <div className="add-footer">
        <button type="button" className={`btn-submit ${type}`} onClick={handleSubmit} disabled={loading}>
          {loading ? '◷ A guardar...' : '✓ Adicionar'}
        </button>
      </div>
    </div>
  );
};

export default AddTab;
