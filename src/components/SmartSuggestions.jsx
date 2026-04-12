import React from 'react';
import { formatCurrency, getCategoryById } from '../utils/data';

const SmartSuggestions = ({ suggestions }) => {
  if (suggestions.length === 0) return null;
  
  const getIcon = (type) => {
    switch (type) {
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'tip': return '💡';
      case 'success': return '✅';
      default: return '📊';
    }
  };
  
  const getColor = (type) => {
    switch (type) {
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      case 'tip': return '#8b5cf6';
      case 'success': return '#10b981';
      default: return '#6b7280';
    }
  };
  
  return (
    <div className="smart-suggestions">
      <div className="suggestions-header">
        <h3>💡 Sugestões Inteligentes</h3>
      </div>
      {suggestions.map((suggestion, index) => (
        <div 
          key={index} 
          className="suggestion-card"
          style={{ borderLeftColor: getColor(suggestion.type) }}
        >
          <div className="suggestion-icon">{getIcon(suggestion.type)}</div>
          <div className="suggestion-content">
            <div className="suggestion-title">{suggestion.title}</div>
            <div className="suggestion-message">{suggestion.message}</div>
            {suggestion.potentialSaving > 0 && (
              <div className="suggestion-saving">
                Potencial economia: {formatCurrency(suggestion.potentialSaving)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SmartSuggestions;
