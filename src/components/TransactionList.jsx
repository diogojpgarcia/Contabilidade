import React from 'react';
import { getCategoryById, formatCurrency, MONTHS_SHORT } from '../utils/data';

const TransactionList = ({ transactions, onDelete }) => {
  if (transactions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📝</div>
        <p>Ainda não há transações</p>
        <p className="empty-hint">Clique no botão + para adicionar</p>
      </div>
    );
  }

  // Group transactions by date
  const groupedTransactions = transactions.reduce((groups, transaction) => {
    const date = transaction.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  const formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    const monthName = MONTHS_SHORT[parseInt(month) - 1];
    return `${day} ${monthName} ${year}`;
  };

  return (
    <div className="transaction-list">
      {sortedDates.map(date => (
        <div key={date} className="transaction-group">
          <div className="group-date">{formatDate(date)}</div>
          {groupedTransactions[date].map(transaction => {
            const category = getCategoryById(transaction.category, transaction.type);
            return (
              <div key={transaction.id} className={`transaction-item ${transaction.type}`}>
                <div className="transaction-icon" style={{ backgroundColor: category.color }}>
                  {category.icon}
                </div>
                <div className="transaction-details">
                  <div className="transaction-category">{category.label}</div>
                  {transaction.description && (
                    <div className="transaction-description">{transaction.description}</div>
                  )}
                </div>
                <div className="transaction-amount">
                  {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                </div>
                <button
                  onClick={() => onDelete(transaction.id)}
                  className="btn-delete"
                  aria-label="Eliminar transação"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default TransactionList;
