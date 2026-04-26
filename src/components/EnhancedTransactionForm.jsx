import React, { useState } from 'react';
import { CATEGORIES_EXPENSE, CATEGORIES_INCOME, getToday, generateId } from '../utils/data';

const EnhancedTransactionForm = ({ onAdd, onCancel }) => {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getToday());

  const categories = type === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;
  const selectedCategory = categories.find(c => c.id === category);

  // Quick amount buttons
  const quickAmounts = type === 'expense' 
    ? [5, 10, 20, 50, 100]
    : [100, 500, 1000, 1500, 2000];

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!amount || !category) {
      alert('Por favor, preenche todos os campos obrigatórios');
      return;
    }

    const transaction = {
      id: generateId(),
      type,
      amount: parseFloat(amount),
      category,
      subcategory: subcategory || null,
      description: description.trim(),
      date,
    };

    onAdd(transaction);
  };

  const handleQuickAmount = (value) => {
    setAmount(value.toString());
  };

  return (
    <div className="transaction-form-overlay" onClick={onCancel}>
      <div className="enhanced-transaction-form" onClick={(e) => e.stopPropagation()}>
        <div className="form-header">
          <h2>Nova Transação</h2>
          <button onClick={onCancel} className="btn-close">×</button>
        </div>

        <form onSubmit={handleSubmit} className="form-body">
          {/* Type Toggle */}
          <div className="form-section">
            <label>Tipo</label>
            <div className="type-toggle">
              <button
                type="button"
                className={`type-btn ${type === 'expense' ? 'active expense' : ''}`}
                onClick={() => {
                  setType('expense');
                  setCategory('');
                  setSubcategory('');
                }}
              >
                💸 Despesa
              </button>
              <button
                type="button"
                className={`type-btn ${type === 'income' ? 'active income' : ''}`}
                onClick={() => {
                  setType('income');
                  setCategory('');
                  setSubcategory('');
                }}
              >
                💰 Receita
              </button>
            </div>
          </div>

          {/* Amount with Quick Buttons */}
          <div className="form-section">
            <label htmlFor="amount">Valor (€) *</label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="amount-input"
              required
            />
            <div className="quick-amounts">
              {quickAmounts.map(value => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleQuickAmount(value)}
                  className="quick-amount-btn"
                >
                  {value}€
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="form-section">
            <label htmlFor="category">Categoria *</label>
            <div className="category-grid">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategory(cat.id);
                    setSubcategory('');
                  }}
                  className={`category-card ${category === cat.id ? 'active' : ''}`}
                  style={{
                    '--category-color': cat.color,
                    borderColor: category === cat.id ? cat.color : 'var(--border-color)'
                  }}
                >
                  <div className="category-icon" style={{ backgroundColor: cat.color }}>
                    {cat.icon}
                  </div>
                  <div className="category-label">{cat.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Subcategory */}
          {selectedCategory && selectedCategory.subcategories && selectedCategory.subcategories.length > 0 && (
            <div className="form-section">
              <label>Subcategoria (opcional)</label>
              <div className="subcategory-list">
                {selectedCategory.subcategories.map(sub => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSubcategory(sub.id)}
                    className={`subcategory-btn ${subcategory === sub.id ? 'active' : ''}`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="form-section">
            <label htmlFor="description">Descrição (opcional)</label>
            <input
              id="description"
              type="text"
              placeholder="Ex: Compras Continente, Jantar fora..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Date */}
          <div className="form-section">
            <label htmlFor="date">Data *</label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={getToday()}
              required
            />
          </div>

          {/* Actions */}
          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn-cancel">
              Cancelar
            </button>
            <button type="submit" className={`btn-submit ${type}`}>
              ✓ Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EnhancedTransactionForm;
