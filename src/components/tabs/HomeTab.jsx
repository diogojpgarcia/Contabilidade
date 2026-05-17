import React from 'react';
import HomeHero          from '../home/HomeHero';
import HomeCashflow      from '../home/HomeCashflow';
import HomeInsight       from '../home/HomeInsight';
import HomeAccounts      from '../home/HomeAccounts';
import HomeRecurring     from '../home/HomeRecurring';
import HomeQuickActions  from '../home/HomeQuickActions';
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
<div className="h-sections">
        <div style={{background:'red',color:'#fff',padding:'8px',textAlign:'center',fontWeight:'bold'}}>CURRENT HOME FILE</div>

        {/* 1 — Flagship balance hero */}
        <HomeHero
          patrimonyTotal={patrimonyTotal}
          monthlyBalance={balance}
          currentMonth={currentMonth}
          financialMonthStartDay={financialMonthStartDay}
        />

        {/* 2 — Command-center quick action hub */}
        <HomeQuickActions onNavigate={onNavigate} />

        {/* 3 — Monthly cashflow overview */}
        <HomeCashflow
          income={income}
          expenses={expenses}
          balance={balance}
          currentMonth={currentMonth}
          onMonthChange={onMonthChange}
          financialMonthStartDay={financialMonthStartDay}
        />

        {/* 4 — Contextual insight */}
        <HomeInsight
          transactions={transactions}
          onNavigate={onNavigate}
          financialFocus={financialFocus}
        />

        {/* 5 — Upcoming recurring payments */}
        <HomeRecurring
          recurringPayments={recurringPayments}
          confirmedRecurring={confirmedRecurring}
          categories={categories}
        />

        {/* 6 — Account balances (shown only when accounts exist) */}
        <HomeAccounts accounts={p.accounts || []} />

      </div>
    </div>
  );
};

export default HomeTab;
