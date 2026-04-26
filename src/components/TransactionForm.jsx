import React, { useState } from 'react';
import { CATEGORIES_EXPENSE, CATEGORIES_INCOME, getToday, generateId } from '../utils/data';

const TransactionForm = ({ onAdd, onCancel }) => {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getToday());

  const categories = type === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!amount || !category) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    const transaction = {
      id: generateId(),
      type,
      amount: parseFloat(amount),
      category,
      description: description.trim(),
      date,
    };

    onAdd(transaction);
  };

  return (
    <div className="transaction-form-overlay" onClick={onCancel}>
      <div className="transaction-form" onClick={(e) => e.stopPropagation()}>
        <div className="form-header">
          <h2>Nova Transação</h2>
          <button onClick={onCancel} className="btn-close">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tipo</label>
            <div className="type-toggle">
              <button
                type="button"
                className={`type-btn ${type === 'expense' ? 'active expense' : ''}`}
                onClick={() => {
                  setType('expense');
                  setCategory('');
                }}
              >
                Despesa
              </button>
              <button
                type="button"
                className={`type-btn ${type === 'income' ? 'active income' : ''}`}
                onClick={() => {
                  setType('income');
                  setCategory('');
                }}
              >
                Receita
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="amount">Valor (€) *</label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Categoria *</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              <option value="">Selecione uma categoria</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description">Descrição</label>
            <input
              id="description"
              type="text"
              placeholder="Opcional"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="form-group">
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

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className={`btn-primary ${type}`}>
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;
