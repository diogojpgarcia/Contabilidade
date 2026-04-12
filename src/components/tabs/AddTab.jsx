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

  const currentCategories = type === 'expense' ? categories.expense : categories.income;

  const handleSubmit = async () => {
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

      alert('✅ Transação adicionada!');
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Erro ao adicionar transação: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-tab">
      <div className="add-header">
        <h2 className="add-title">➕ Nova Transação</h2>
        <p className="add-subtitle">Adiciona receitas ou despesas rapidamente</p>
      </div>

      <div className="add-form">
        {/* Type Toggle */}
        <div className="type-toggle">
          <button
            className={`type-btn expense ${type === 'expense' ? 'active' : ''}`}
            onClick={() => {
              setType('expense');
              setCategory('');
            }}
          >
            <span className="type-icon">💳</span>
            <span className="type-label">Despesa</span>
          </button>
          <button
            className={`type-btn income ${type === 'income' ? 'active' : ''}`}
            onClick={() => {
              setType('income');
              setCategory('');
            }}
          >
            <span className="type-icon">💰</span>
            <span className="type-label">Receita</span>
          </button>
        </div>

        {/* Amount */}
        <div className="form-group">
          <label>Valor</label>
          <div className="amount-input-group">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              inputMode="decimal"
            />
            <span className="currency-symbol">€</span>
          </div>
        </div>

        {/* Category */}
        <div className="form-group">
          <label>Categoria</label>
          <div className="category-grid">
            {currentCategories.map(cat => (
              <button
                key={cat.id}
                className={`category-option ${category === cat.name ? 'selected' : ''}`}
                onClick={() => setCategory(cat.name)}
              >
                <span className="category-option-icon">{cat.icon}</span>
                <span className="category-option-name">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="form-group">
          <label>Descrição (opcional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Compras Continente"
            maxLength={100}
          />
        </div>

        {/* Date */}
        <div className="form-group">
          <label>Data</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* Submit */}
        <button
          className={`btn-submit ${type}`}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <span className="loading-spinner-small" />
          ) : (
            <>
              <span className="submit-icon">✓</span>
              <span className="submit-text">Adicionar Transação</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AddTab;
