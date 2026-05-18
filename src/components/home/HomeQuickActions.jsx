import React from 'react';
import { Plus, BarChart2, LayoutGrid, RefreshCw } from 'lucide-react';

const ACTIONS = [
  {
    id: 'add',
    icon: <Plus size={22} strokeWidth={2.25} />,
    iconBg:    'rgba(6, 182, 212, 0.15)',
    iconColor: '#06b6d4',
    label: 'Adicionar',
    tab: 'add',
  },
  {
    id: 'stats',
    icon: <BarChart2 size={20} strokeWidth={1.75} />,
    iconBg:    'rgba(107, 122, 219, 0.14)',
    iconColor: '#a5b4fc',
    label: 'Histórico',
    tab: 'stats',
  },
  {
    id: 'budget',
    icon: <LayoutGrid size={19} strokeWidth={1.75} />,
    iconBg:    'rgba(52, 211, 153, 0.13)',
    iconColor: '#34d399',
    label: 'Budget',
    tab: 'budget',
  },
  {
    id: 'recurring',
    icon: <RefreshCw size={18} strokeWidth={1.75} />,
    iconBg:    'rgba(248, 113, 113, 0.13)',
    iconColor: '#f87171',
    label: 'Recorrentes',
    tab: 'budget',
  },
];

const HomeQuickActions = ({ onNavigate }) => (
  <div className="h-cmd-strip" role="toolbar" aria-label="Ações rápidas">
    {ACTIONS.map(({ id, icon, iconBg, iconColor, label, tab }) => (
      <button
        key={id}
        type="button"
        className="h-cmd-btn"
        aria-label={label}
        title={label}
        onClick={() => onNavigate?.(tab)}
      >
        <span
          className="h-cmd-icon"
          style={{ background: iconBg, color: iconColor }}
          aria-hidden="true"
        >
          {icon}
        </span>
      </button>
    ))}
  </div>
);

export default HomeQuickActions;
