import React, { useState } from 'react';
import { dbService } from '../../lib/supabase';
import './AddTab.css';

const AddTab = ({ user, categories, onTransactionAdded }) => {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  console.log('🎨 AddTab rendering...', { user: user?.email, categories: categories?.expense?.length });

  const currentCategories = type === 'expense' ? categories.expense : categories.income;

  const getCategoryIcon = (categoryName) => {
    const iconMap = {
      'Alimentação': '⚑',
      'Habitação': '⌂',
      'Transporte': '⚐',
      'Saúde': '✚',
      'Lazer': '◉',
      'Educação': '⊞',
      'Roupa': '◫',
      'Tecnologia': '◧',
      'Subscrições': '◉',
      'Outros': '◌',
      'Salário': '◈',
      'Freelance': '◐',
      'Investimentos': '◭',
      'Bonus': '◆',
      'Outros Rendimentos': '◌'
    };
    return iconMap[categoryName] || '◌';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!amount || !category) {
      alert('Preenche o valor e categoria!');
      return;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      alert('Valor inválido!');
      return;
    }

    setLoading(true);

    try {
      const transaction = {
        user_id: user.id,
        type,
        amount: amountValue,
        category,
        description: description.trim() || null,
        date
      };

      await dbService.addTransaction(transaction);

      // Reset form
      setAmount('');
      setCategory('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);

      // Notify parent
      if (onTransactionAdded) {
        onTransactionAdded();
      }

      alert('✓ Transação adicionada!');
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('✕ Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-tab">
      <div className="add-header">
        <h2>Nova Transação</h2>
        <p>Adiciona receitas ou despesas</p>
      </div>

      <div className="add-form-container">
        {/* Type Toggle */}
        <div className="type-toggle">
          <button
            type="button"
            className={`type-btn ${type === 'expense' ? 'active expense' : ''}`}
            onClick={() => {
              setType('expense');
              setCategory('');
            }}
          >
            <span className="type-icon-sf">−</span>
            <span>Despesa</span>
          </button>
          <button
            type="button"
            className={`type-btn ${type === 'income' ? 'active income' : ''}`}
            onClick={() => {
              setType('income');
              setCategory('');
            }}
          >
            <span className="type-icon-sf">+</span>
            <span>Receita</span>
          </button>
        </div>

        {/* Amount */}
        <div className="form-field">
          <label>Valor</label>
          <div className="amount-input">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              inputMode="decimal"
            />
            <span className="currency">€</span>
          </div>
        </div>

        {/* Category */}
        <div className="form-field">
          <label>Categoria</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="category-select"
          >
            <option value="">Seleciona uma categoria</option>
            {currentCategories.map(cat => (
              <option key={cat.id} value={cat.label}>
                {getCategoryIcon(cat.label)} {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="form-field">
          <label>Descrição (opcional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Compras supermercado"
            maxLength={100}
            className="text-input"
          />
        </div>

        {/* Date */}
        <div className="form-field">
          <label>Data</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="date-input"
          />
        </div>

        {/* Submit */}
        <button
          type="button"
          className={`btn-submit ${type}`}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '◷ A guardar...' : '✓ Adicionar'}
        </button>
      </div>
    </div>
  );
};

export default AddTab;
