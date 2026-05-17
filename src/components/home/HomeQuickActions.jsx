import React from 'react';
import { Plus, BarChart2, LayoutGrid, RefreshCw, Wallet } from 'lucide-react';
import CosmosSectionHeader from '../cosmos/CosmosSectionHeader';
import CosmosQuickAction, { CosmosQuickActionGrid } from '../cosmos/CosmosQuickAction';

const ACTIONS = [
  {
    id: 'add',
    icon: <Plus size={20} strokeWidth={2.25} />,
    iconBg:    'rgba(6, 182, 212, 0.15)',
    iconColor: '#06b6d4',
    label: 'Adicionar',
    tab: 'add',
    accent: true,
  },
  {
    id: 'stats',
    icon: <BarChart2 size={19} strokeWidth={1.75} />,
    iconBg:    'rgba(107, 122, 219, 0.14)',
    iconColor: '#a5b4fc',
    label: 'Histórico',
    tab: 'stats',
  },
  {
    id: 'budget',
    icon: <LayoutGrid size={18} strokeWidth={1.75} />,
    iconBg:    'rgba(52, 211, 153, 0.13)',
    iconColor: '#34d399',
    label: 'Budget',
    tab: 'budget',
  },
  {
    id: 'recurring',
    icon: <RefreshCw size={17} strokeWidth={1.75} />,
    iconBg:    'rgba(248, 113, 113, 0.13)',
    iconColor: '#f87171',
    label: 'Recorrentes',
    tab: 'budget',
  },
];

const HomeQuickActions = ({ onNavigate }) => (
  <div className="h-quick-section">
    <CosmosSectionHeader title="Ações rápidas" />
    <CosmosQuickActionGrid>
      {ACTIONS.map(({ id, icon, iconBg, iconColor, label, tab, accent }) => (
        <CosmosQuickAction
          key={id}
          icon={icon}
          iconBg={iconBg}
          iconColor={iconColor}
          label={label}
          accent={accent}
          onClick={() => onNavigate?.(tab)}
        />
      ))}
    </CosmosQuickActionGrid>
  </div>
);

export default HomeQuickActions;
