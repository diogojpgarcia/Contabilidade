/**
 * categoryIcons.js — Unified category → icon + color registry.
 *
 * Single source of truth used across BudgetTab, FintechTransactionCard,
 * and any future component that needs category iconography.
 *
 * Colors are chosen to be:
 *  - Semantically meaningful (amber = food, blue = housing, etc.)
 *  - Consistent across every screen in the app
 *  - Compatible with both Fintech-dark and Soft-Future surfaces
 */
import React from 'react';
import {
  Utensils, Car, Home, Heart, Wallet, Briefcase,
  ArrowRightLeft, Zap, Smartphone, Plane, BookOpen,
  Shirt, Gift, Baby, PiggyBank, TrendingUp, RefreshCw,
  Tag, Trophy, CreditCard, Scale, ShoppingBag, Receipt,
  Music, PawPrint, Scissors, Building, Coins,
} from '../components/icons';

/* ── Canonical colour + icon per Portuguese category name ─────────────────── */
export const CATEGORY_META = {
  /* ── Expense ──────────────────────────────────────────────────────────── */
  'Alimentação':                { Icon: Utensils,   color: '#F59E0B' }, // amber  — warm/food
  'Habitação':                  { Icon: Home,       color: '#3B82F6' }, // blue   — stable
  'Transporte':                 { Icon: Car,        color: '#8B5CF6' }, // violet
  'Saúde':                      { Icon: Heart,      color: '#10B981' }, // emerald — wellness
  'Lazer':                      { Icon: Music,      color: '#EC4899' }, // pink   — fun
  'Lazer & Entretenimento':     { Icon: Music,      color: '#EC4899' },
  'Educação':                   { Icon: BookOpen,   color: '#06B6D4' }, // cyan   — knowledge
  'Roupa':                      { Icon: Shirt,      color: '#F97316' }, // orange
  'Roupa & Calçado':            { Icon: Shirt,      color: '#F97316' },
  'Tecnologia':                 { Icon: Smartphone, color: '#6366F1' }, // indigo — digital
  'Subscrições':                { Icon: Smartphone, color: '#7C3AED' }, // purple
  'Comunicações':               { Icon: Smartphone, color: '#0EA5E9' }, // sky
  'Utilities':                  { Icon: Zap,        color: '#EAB308' }, // yellow
  'Serviços Financeiros':       { Icon: Building,   color: '#1D4ED8' }, // dark blue
  'Viagens & Férias':           { Icon: Plane,      color: '#0EA5E9' }, // sky
  'Presentes & Doações':        { Icon: Gift,       color: '#EC4899' }, // pink
  'Animais de Estimação':       { Icon: PawPrint,   color: '#F97316' }, // orange
  'Crianças & Família':         { Icon: Baby,       color: '#A855F7' }, // purple
  'Cuidados Pessoais':          { Icon: Scissors,   color: '#EC4899' }, // pink
  'Casa & Jardim':              { Icon: Home,       color: '#10B981' }, // emerald
  'Impostos & Taxas':           { Icon: Receipt,    color: '#DC2626' }, // red
  'Emergências':                { Icon: Receipt,    color: '#DC2626' }, // red
  'Outros':                     { Icon: ShoppingBag,color: '#6B7280' }, // gray
  /* ── Income ───────────────────────────────────────────────────────────── */
  'Salário':                    { Icon: Wallet,     color: '#10B981' },
  'Salário Principal':          { Icon: Wallet,     color: '#10B981' },
  'Subsídios':                  { Icon: Wallet,     color: '#10B981' },
  'Freelance':                  { Icon: Briefcase,  color: '#10B981' },
  'Trabalho Extra / Freelance': { Icon: Briefcase,  color: '#10B981' },
  'Trabalho Extra':             { Icon: Briefcase,  color: '#10B981' },
  'Investimentos':              { Icon: TrendingUp, color: '#10B981' },
  'Rendas Recebidas':           { Icon: Home,       color: '#10B981' },
  'Reembolsos':                 { Icon: RefreshCw,  color: '#10B981' },
  'Vendas':                     { Icon: Tag,        color: '#10B981' },
  'Prémios & Sorteios':         { Icon: Trophy,     color: '#10B981' },
  'Prendas & Doações Recebidas':{ Icon: Gift,       color: '#10B981' },
  'Bonus':                      { Icon: PiggyBank,  color: '#10B981' },
  'Outros Rendimentos':         { Icon: Wallet,     color: '#10B981' },
};

/* Fallbacks for special transaction types */
const TRANSFER_META  = { Icon: ArrowRightLeft, color: '#9CA3AF' };
const ADJUST_META    = { Icon: Scale,          color: '#F97316' };
const INCOME_DEFAULT = { Icon: Wallet,         color: '#10B981' };
const EXPENSE_DEFAULT= { Icon: ShoppingBag,    color: '#6B7280' };

/**
 * getCategoryMeta(name, type?)
 * Returns { Icon, color } for any category name + optional transaction type.
 * Always returns a valid object — never undefined.
 */
export function getCategoryMeta(name, type) {
  if (type === 'transfer')   return TRANSFER_META;
  if (type === 'adjustment') return ADJUST_META;
  const meta = CATEGORY_META[name];
  if (meta) return meta;
  return type === 'income' ? INCOME_DEFAULT : EXPENSE_DEFAULT;
}

/**
 * getCategoryColor(name, type?)
 * Convenience wrapper — returns just the hex color string.
 */
export function getCategoryColor(name, type) {
  return getCategoryMeta(name, type).color;
}

/* ── Patrimony asset-type icon + colour map ───────────────────────────────── */
export const PATRIMONY_META = {
  accounts:   { Icon: Wallet,     color: '#D97706' }, // amber
  stocks:     { Icon: TrendingUp, color: '#059669' }, // emerald
  bonds:      { Icon: PiggyBank,  color: '#7C3AED' }, // violet
  realestate: { Icon: Home,       color: '#DC2626' }, // red
  vehicles:   { Icon: Car,        color: '#0891B2' }, // cyan
  crypto:     { Icon: Coins,      color: '#F59E0B' }, // yellow-amber
};

/**
 * CategoryIconBubble — standalone icon bubble component.
 * Renders a rounded container with the category SVG icon inside.
 * Accepts all the same props as getCategoryMeta plus layout props.
 */
export const CategoryIconBubble = ({ name, type, size = 36, radius = '10px', className = '' }) => {
  const { Icon, color } = getCategoryMeta(name, type);
  return (
    <div
      className={`cat-icon-bubble${className ? ' ' + className : ''}`}
      style={{
        width: size, height: size,
        background: `${color}22`,
        borderRadius: radius,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon size={Math.round(size * 0.50)} color={color} strokeWidth={2} />
    </div>
  );
};
