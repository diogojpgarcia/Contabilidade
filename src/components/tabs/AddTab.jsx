import React, { useState, useEffect } from 'react';
import { dbService } from '../../lib/supabase';
import './AddTab.css';

const AddTab = ({ user, categories, onTransactionAdded, onTransfer, theme = 'default' }) => {
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
    if (type === 'transfer' && (!transferFrom.trim() || !transferTo.trim())) { alert('Preenche origem e destino!'); return; }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) { alert('Valor inválido!'); return; }

    setLoading(true);
    try {
      if (type === 'transfer') {
        if (onTransfer) await onTransfer(transferFrom.trim(), transferTo.trim(), amountValue);
        setAmount(''); setTransferFrom(''); setTransferTo('');
        setDate(new Date().toISOString().split('T')[0]);
      } else if (type === 'goal') {
        const updatedGoals = goals.map(g =>
          g.id === selectedGoal ? { ...g, currentSavings: (g.currentSavings || 0) + amountValue } : g
        );
        await dbService.updateUserSettings(user.id, { goals: updatedGoals });
      } else {
        const transaction = { type, amount: amountValue, category, description: description.trim() || null, date };
        if (onTransactionAdded) await onTransactionAdded(transaction);
      }
      if (type !== 'transfer') {
        setAmount(''); setCategory(''); setSelectedGoal(''); setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        loadGoals();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('✕ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const switchType = (newType) => { setType(newType); setCategory(''); setSelectedGoal(''); setTransferFrom(''); setTransferTo(''); };

  /* ── MODERN BRANCH ─────────────────────────────────────────────────────── */
  if (theme === 'modern') {
    return (
      <div className="m-add-page">
        <div className="m-add-header">
          <div className="m-page-title">Nova Transação</div>
        </div>

        <div className="m-form">
          {/* Type toggle */}
          <div className="m-toggle" style={{ margin: '0 0 2px' }}>
            <button className={`m-toggle-btn ${type === 'expense' ? 'active' : ''}`} onClick={() => switchType('expense')}>
              − Despesa
            </button>
            <button className={`m-toggle-btn ${type === 'income' ? 'active' : ''}`} onClick={() => switchType('income')}>
              + Receita
            </button>
            <button className={`m-toggle-btn ${type === 'transfer' ? 'active' : ''}`} onClick={() => switchType('transfer')}>
              ↕ Transferência
            </button>
            <button className={`m-toggle-btn ${type === 'goal' ? 'active' : ''}`} onClick={() => switchType('goal')}>
              ◆ Objetivo
            </button>
          </div>

          {/* Amount */}
          <div className="m-amount-field">
            <input
              type="number"
              className="m-amount-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              inputMode="decimal"
            />
            <span className="m-currency">€</span>
          </div>

          {/* Transfer fields */}
          {type === 'transfer' && (
            <>
              <div className="m-field-card">
                <span className="m-field-label">Conta de origem</span>
                <input type="text" className="m-field-input" value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)} placeholder="Ex: Conta Corrente" maxLength={50} />
              </div>
              <div className="m-field-card">
                <span className="m-field-label">Conta de destino</span>
                <input type="text" className="m-field-input" value={transferTo} onChange={(e) => setTransferTo(e.target.value)} placeholder="Ex: Poupança" maxLength={50} />
              </div>
            </>
          )}

          {/* Category or Goal (hidden for transfers) */}
          {type !== 'transfer' && (type === 'goal' ? (
            <div className="m-field-card">
              <span className="m-field-label">Objetivo</span>
              <select
                className="m-field-select"
                value={selectedGoal}
                onChange={(e) => setSelectedGoal(e.target.value)}
              >
                <option value="">Seleciona um objetivo</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>
                    ◆ {g.name} ({g.currentSavings?.toFixed(0) || 0}€ / {g.amount.toFixed(0)}€)
                  </option>
                ))}
              </select>
              {goals.length === 0 && (
                <span className="m-helper">Sem objetivos. Cria um em Budget → Objetivos</span>
              )}
            </div>
          ) : (
            <div className="m-field-card">
              <span className="m-field-label">Categoria</span>
              <select
                className="m-field-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Seleciona uma categoria</option>
                {currentCategories.map(cat => (
                  <option key={cat.id} value={cat.label}>
                    {getCategoryIcon(cat.label)} {cat.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {/* Description */}
          <div className="m-field-card">
            <span className="m-field-label">Descrição (opcional)</span>
            <input
              type="text"
              className="m-field-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Compras supermercado"
              maxLength={100}
            />
          </div>

          {/* Date */}
          <div className="m-field-card">
            <span className="m-field-label">Data</span>
            <input
              type="date"
              className="m-field-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Submit */}
          <button
            className={`m-submit-btn ${type}`}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'A guardar…' : '✓ Adicionar'}
          </button>
        </div>
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

      <div className="add-form-container">
        {/* Type Toggle */}
        <div className="type-toggle">
          <button type="button" className={`type-btn ${type === 'expense' ? 'active expense' : ''}`} onClick={() => switchType('expense')}>
            <span className="type-icon-sf">−</span><span>Despesa</span>
          </button>
          <button type="button" className={`type-btn ${type === 'income' ? 'active income' : ''}`} onClick={() => switchType('income')}>
            <span className="type-icon-sf">+</span><span>Receita</span>
          </button>
          <button type="button" className={`type-btn ${type === 'transfer' ? 'active transfer' : ''}`} onClick={() => switchType('transfer')}>
            <span className="type-icon-sf">↕</span><span>Transferência</span>
          </button>
          <button type="button" className={`type-btn ${type === 'goal' ? 'active goal' : ''}`} onClick={() => switchType('goal')}>
            <span className="type-icon-sf">◆</span><span>Objetivos</span>
          </button>
        </div>

        {type === 'transfer' && (
          <>
            <div className="form-field">
              <label>Conta de origem</label>
              <input type="text" value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)} placeholder="Ex: Conta Corrente" maxLength={50} className="text-input" />
            </div>
            <div className="form-field">
              <label>Conta de destino</label>
              <input type="text" value={transferTo} onChange={(e) => setTransferTo(e.target.value)} placeholder="Ex: Poupança" maxLength={50} className="text-input" />
            </div>
          </>
        )}

        <div className="form-field">
          <label>Valor</label>
          <div className="amount-input">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" step="0.01" min="0" inputMode="decimal" />
            <span className="currency">€</span>
          </div>
        </div>

        {type !== 'transfer' && (type === 'goal' ? (
          <div className="form-field">
            <label>Objetivo</label>
            <select value={selectedGoal} onChange={(e) => setSelectedGoal(e.target.value)} className="category-select">
              <option value="">Seleciona um objetivo</option>
              {goals.map(goal => (
                <option key={goal.id} value={goal.id}>◆ {goal.name} ({goal.currentSavings?.toFixed(0) || 0}€ / {goal.amount.toFixed(0)}€)</option>
              ))}
            </select>
            {goals.length === 0 && <p className="helper-text">Sem objetivos ativos. Cria um em Budget → Objetivos</p>}
          </div>
        ) : (
          <div className="form-field">
            <label>Categoria</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="category-select">
              <option value="">Seleciona uma categoria</option>
              {currentCategories.map(cat => (
                <option key={cat.id} value={cat.label}>{getCategoryIcon(cat.label)} {cat.label}</option>
              ))}
            </select>
          </div>
        ))}

        <div className="form-field">
          <label>Descrição (opcional)</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Compras supermercado" maxLength={100} className="text-input" />
        </div>

        <div className="form-field">
          <label>Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().split('T')[0]} className="date-input" />
        </div>

        <button type="button" className={`btn-submit ${type}`} onClick={handleSubmit} disabled={loading}>
          {loading ? '◷ A guardar...' : '✓ Adicionar'}
        </button>
      </div>
    </div>
  );
};

export default AddTab;
