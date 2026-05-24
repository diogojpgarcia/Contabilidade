import React from 'react';
import HomeGreeting      from '../home/HomeGreeting';
import HomeHero          from '../home/HomeHero';
import HomeRecurring     from '../home/HomeRecurring';
import QuickActionsRow   from '../QuickActionsRow';
import AccountsSection   from '../AccountsSection';
import InsightsSection   from '../InsightsSection';
import { useAppContext } from '../../context/AppContext';
import '../home/Home.css';

const HomeTab = ({
  balance, totalBalance = 0, transactions, currentMonth,
  patrimony = {},
  financialMonthStartDay = 1,
  homeUsesFinancialMonth = true,
  onNavigate,
  recurringPayments,
  confirmedRecurring = {},
  userName = '',
  financialFocus = null,
}) => {
  const { categories } = useAppContext();
  const p = patrimony;

  /* ── Patrimony sub-totals — pure derivation, never stored ── */
  const sumAccounts   = (p.accounts   || []).reduce((s, x) => s + (parseFloat(x.currentBalance ?? x.balance) || 0), 0);
  const sumStocks     = (p.stocks     || []).reduce((s, x) => s + (parseFloat(x.qty)      || 0) * (parseFloat(x.avgPrice) || 0), 0);
  const sumBonds      = (p.bonds      || []).reduce((s, x) => s + (parseFloat(x.value)    || 0), 0);
  const sumRealestate = (p.realestate || []).reduce((s, x) => s + (parseFloat(x.value)    || 0), 0);
  const sumVehicles   = (p.vehicles   || []).reduce((s, x) => s + (parseFloat(x.value)    || 0), 0);
  const sumCrypto     = (p.crypto     || []).reduce((s, x) => s + (parseFloat(x.qty)      || 0) * (parseFloat(x.price) || 0), 0);

  const patrimonyTotal = sumAccounts + sumStocks + sumBonds + sumRealestate + sumVehicles + sumCrypto;

  function getCycleDayInfo(homeUsesFinancialMonth, financialMonthStartDay) {
    const today = new Date();
    const d = today.getDate();
    const S = (homeUsesFinancialMonth && financialMonthStartDay > 1) ? financialMonthStartDay : 1;

    if (S === 1) {
      const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      return { diaAtual: d, totalDias: totalDays };
    }

    // Financial cycle: starts on day S of a month
    let cycleStartYear = today.getFullYear();
    let cycleStartMonth = today.getMonth();
    if (d < S) {
      // Still in previous cycle
      cycleStartMonth -= 1;
      if (cycleStartMonth < 0) { cycleStartMonth = 11; cycleStartYear -= 1; }
    }

    const cycleEndMonth = (cycleStartMonth + 1) % 12;
    const cycleEndYear = cycleStartMonth === 11 ? cycleStartYear + 1 : cycleStartYear;

    const cycleStart = new Date(cycleStartYear, cycleStartMonth, S);
    const cycleEnd   = new Date(cycleEndYear, cycleEndMonth, S);
    const totalDias  = Math.round((cycleEnd - cycleStart) / 86400000);
    const diaAtual   = Math.round((today - cycleStart) / 86400000) + 1;

    return { diaAtual: Math.max(1, diaAtual), totalDias };
  }

  return (
    <div className="h-page">

      {/* ── GREETING BAR — above everything ── */}
      <HomeGreeting name={userName} />

      {/* ── PRIMARY STAGE — hero ── */}
      <div className="h-primary-zone">
        <HomeHero
          patrimonio={(parseFloat(patrimonyTotal) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'}
          despesasMes={balance < 0
            ? (parseFloat(balance) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'
            : undefined}
          diaAtual={getCycleDayInfo(homeUsesFinancialMonth, financialMonthStartDay).diaAtual}
          totalDias={getCycleDayInfo(homeUsesFinancialMonth, financialMonthStartDay).totalDias}
        />
      </div>

      {/* ── QUICK ACTIONS ROW — immediately below hero ── */}
      <QuickActionsRow onNavigate={onNavigate} />

      {/* ── ACCOUNTS SECTION — horizontal scroll, below quick actions ── */}
      <AccountsSection accounts={p.accounts} onNavigate={onNavigate} />

      {/* ── DATA ZONE — cashflow panel + context cluster ── */}
      <div className="h-sections">

        {/* Insights grid — below cashflow, above context cards */}
        <InsightsSection
          transactions={transactions}
          currentMonth={currentMonth}
          recurringPayments={recurringPayments}
          onNavigate={onNavigate}
        />

        {/* Upcoming recurring payments */}
        <HomeRecurring
          recurringPayments={recurringPayments}
          confirmedRecurring={confirmedRecurring}
          categories={categories}
          onNavigate={onNavigate}
        />
