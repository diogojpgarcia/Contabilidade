import React, { useState } from 'react';

const TransactionFilters = ({ 
  onFilterChange, 
  categories,
  onExport 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const handleFilterChange = () => {
    const filters = {
      search: searchTerm,
      category: selectedCategory,
      minAmount: minAmount ? parseFloat(minAmount) : null,
      maxAmount: maxAmount ? parseFloat(maxAmount) : null,
      startDate: startDate || null,
      endDate: endDate || null
    };
    onFilterChange(filters);
  };

  React.useEffect(() => {
    handleFilterChange();
  }, [searchTerm, selectedCategory, minAmount, maxAmount, startDate, endDate]);

  const handleReset = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setMinAmount('');
    setMaxAmount('');
    setStartDate('');
    setEndDate('');
  };

  // Combinar categorias de expense e income
  const allCategories = [
    ...(categories?.expense || []),
    ...(categories?.income || [])
  ];

  return (
    <div className="transaction-filters">
      {/* Barra de Pesquisa */}
      <div className="search-bar">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Pesquisar descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button 
              className="clear-search"
              onClick={() => setSearchTerm('')}
            >
              ✕
            </button>
          )}
        </div>
        
        <button 
          className="btn-toggle-filters"
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? '📊 Ocultar Filtros' : '🔧 Filtros'}
        </button>

        {onExport && (
          <button 
            className="btn-export"
            onClick={onExport}
            title="Exportar para Excel"
          >
            📥 Export
          </button>
        )}
      </div>

      {/* Filtros Avançados */}
      {showFilters && (
        <div className="advanced-filters">
          <div className="filters-grid">
            {/* Categoria */}
            <div className="filter-group">
              <label>Categoria</label>
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">Todas</option>
                {allCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Valor Mínimo */}
            <div className="filter-group">
              <label>Valor Mínimo</label>
              <input
                type="number"
                placeholder="0.00"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                step="0.01"
                min="0"
              />
            </div>

            {/* Valor Máximo */}
            <div className="filter-group">
              <label>Valor Máximo</label>
              <input
                type="number"
                placeholder="1000.00"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                step="0.01"
                min="0"
              />
            </div>

            {/* Data Início */}
            <div className="filter-group">
              <label>Data Início</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* Data Fim */}
            <div className="filter-group">
              <label>Data Fim</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Botão Reset */}
            <div className="filter-group">
              <label>&nbsp;</label>
              <button 
                className="btn-reset-filters"
                onClick={handleReset}
              >
                🔄 Limpar Filtros
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionFilters;
