import React from 'react';
import { Plus, ArrowLeftRight, RefreshCw, BarChart2 } from 'lucide-react';

const ACTIONS = [
  { id: 'add',       icon: <Plus size={20} strokeWidth={2} />,             label: 'Transação',  tab: 'add'    },
  { id: 'transfer',  icon: <ArrowLeftRight size={20} strokeWidth={1.75} />, label: 'Transferir', tab: 'add'    },
  { id: 'recurring', icon: <RefreshCw size={20} strokeWidth={1.75} />,      label: 'Recorrente', tab: 'budget' },
  { id: 'insight',   icon: <BarChart2 size={20} strokeWidth={1.75} />,      label: 'Insight',    tab: 'stats'  },
];

const QuickActionsRow = ({ onNavigate }) => (
  <div
    role="toolbar"
    aria-label="Ações rápidas"
    style={{
      display: 'flex',
      justifyContent: 'space-around',
      padding: '16px 20px',
    }}
  >
    {ACTIONS.map(({ id, icon, label, tab }) => (
      <button
        key={id}
        type="button"
        aria-label={label}
        title={label}
        onClick={() => onNavigate?.(tab)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 8px',
          color: '#94A3B8',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span aria-hidden="true" style={{ color: '#94A3B8', display: 'flex' }}>
          {icon}
        </span>
        <span style={{
          fontSize: 10,
          fontWeight: 500,
          color: '#94A3B8',
          letterSpacing: '0.02em',
        }}>
          {label}
        </span>
      </button>
    ))}
  </div>
);

export default QuickActionsRow;
