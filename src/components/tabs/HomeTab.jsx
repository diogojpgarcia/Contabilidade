import React from 'react';
import HomeGreeting      from '../home/HomeGreeting';
import HomeHero          from '../home/HomeHero';
import HomeCashflow      from '../home/HomeCashflow';
import HomeInsight       from '../home/HomeInsight';
import HomeAccounts      from '../home/HomeAccounts';
import HomeRecurring     from '../home/HomeRecurring';
import QuickActionsRow   from '../QuickActionsRow';
import AccountsSection   from '../AccountsSection';
import InsightsSection   from '../InsightsSection';
import '../home/Home.css';

const HomeTab = ({
  balance, income, expenses, totalBalance = 0, transactions,
  currentMonth, onMonthChange,
  patrimony = {},
  financialMonthStartDay = 1,
  theme = 'default',
  onNavigate,
  recurringPayments,
  confirmedRecurring = {},
  categories,
  financialFocus = null,
}) => {
  const p = patrimony;

  /* ── Patrimony sub-totals — pure derivation, never stored ── */
  const sumAccounts   = (p.accounts   || []).reduce((s, x) => s + (parseFloat(x.currentBalance ?? x.balance) || 0), 0);
  const sumStocks     = (p.stocks     || []).reduce((s, x) => s + (parseFloat(x.qty)      || 0) * (parseFloat(x.avgPrice) || 0), 0);
  const sumBonds      = (p.bonds      || []).reduce((s, x) => s + (parseFloat(x.value)    || 0), 0);
  const sumRealestate = (p.realestate || []).reduce((s, x) => s + (parseFloat(x.value)    || 0), 0);
  const sumVehicles   = (p.vehicles   || []).reduce((s, x) => s + (parseFloat(x.value)    || 0), 0);
  const sumCrypto     = (p.crypto     || []).reduce((s, x) => s + (parseFloat(x.qty)      || 0) * (parseFloat(x.price) || 0), 0);

  const patrimonyTotal = sumAccounts + sumStocks + sumBonds + sumRealestate + sumVehicles + sumCrypto;

  return (
    <div className="h-page">

      {/* ── GREETING BAR — above everything ── */}
      <HomeGreeting />

      {/* ── PRIMARY STAGE — hero ── */}
      <div className="h-primary-zone">
        <HomeHero
          patrimonyTotal={patrimonyTotal}
          monthlyBalance={balance}
          currentMonth={currentMonth}
          financialMonthStartDay={financialMonthStartDay}
        />
      </div>

      {/* ── QUICK ACTIONS ROW — immediately below hero ── */}
      <QuickActionsRow onNavigate={onNavigate} />

      {/* ── ACCOUNTS SECTION — horizontal scroll, below quick actions ── */}
      <AccountsSection accounts={p.accounts} onNavigate={onNavigate} />

      {/* ── DATA ZONE — cashflow panel + context cluster ── */}
      <div className="h-sections">

        {/* Monthly cashflow — primary data panel */}
        <HomeCashflow
          income={income}
          expenses={expenses}
          balance={balance}
          currentMonth={currentMonth}
          onMonthChange={onMonthChange}
          financialMonthStartDay={financialMonthStartDay}
        />

        {/* Insights grid — below cashflow, above context cards */}
        <InsightsSection onNavigate={onNavigate} />

        {/* Contextual insight */}
        <HomeInsight
          transactions={transactions}
          onNavigate={onNavigate}
          financialFocus={financialFocus}
        />

        {/* Upcoming recurring payments */}
        <HomeRecurring
          recurringPayments={recurringPayments}
          confirmedRecurring={confirmedRecurring}
          categories={categories}
        />

        {/* Account balances */}
        <HomeAccounts accounts={p.accounts || []} />

      </div>
    </div>
  );
};

export default HomeTab;
