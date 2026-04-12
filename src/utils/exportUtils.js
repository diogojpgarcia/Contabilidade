/**
 * Export transactions to CSV (Excel-compatible)
 */
export const exportToExcel = (transactions, filename = 'transacoes') => {
  if (!transactions || transactions.length === 0) {
    alert('Não há transações para exportar!');
    return;
  }

  // Headers CSV
  const headers = ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor'];
  
  // Convert transactions to CSV rows
  const rows = transactions.map(t => [
    t.date,
    t.type === 'income' ? 'Receita' : 'Despesa',
    t.category || '',
    t.description || '',
    parseFloat(t.amount).toFixed(2)
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Create blob and download
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log(`✅ Exported ${transactions.length} transactions`);
};
