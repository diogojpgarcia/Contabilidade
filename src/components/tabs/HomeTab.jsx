import React from 'react';
import HomeHero      from '../home/HomeHero';
import HomeCashflow  from '../home/HomeCashflow';
import HomeInsight   from '../home/HomeInsight';
import HomeAccounts  from '../home/HomeAccounts';
import HomeEvolution from '../home/HomeEvolution';
import '../home/Home.css';

const HomeTab = ({
  balance, income, expenses, totalBalance = 0, transactions,
  currentMonth, onMonthChange,
  patrimony = {},
  financialMonthStartDay = 1,
  theme = 'default',
  onNavigate,
}) => {
  const p = patrimony;

  // Patrimony sub-totals — pure derivation, never stored
  const sumAccounts   = (p.accounts   || []).reduce((s, x) => s + (parseFloat(x.currentBalance ?? x.balance) || 0), 0);
  const sumStocks     = (p.stocks     || []).reduce((s, x) => s + (parseFloat(x.qty)      || 0) * (parseFloat(x.avgPrice) || 0), 0);
  const sumBonds      = (p.bonds      || []).reduce((s, x) => s + (parseFloat(x.value)    || 0), 0);
  const sumRealestate = (p.realestate || []).reduce((s, x) => s + (parseFloat(x.value)    || 0), 0);
  const sumVehicles   = (p.vehicles   || []).reduce((s, x) => s + (parseFloat(x.value)    || 0), 0);
  const sumCrypto     = (p.crypto     || []).reduce((s, x) => s + (parseFloat(x.qty)      || 0) * (parseFloat(x.price) || 0), 0);

  const patrimonyTotal = sumAccounts + sumStocks + sumBonds + sumRealestate + sumVehicles + sumCrypto;
  const investments    = sumStocks + sumBonds + sumCrypto;
  const realestate     = sumRealestate + sumVehicles;

  const isModern = theme === 'modern' || theme === 'fintech';
  const rootClass = isModern ? 'm-home h-page' : 'home-tab h-page';

  return (
    <div className={rootClass}>
      <HomeHero
        patrimonyTotal={patrimonyTotal}
        monthlyBalance={balance}
        currentMonth={currentMonth}
        financialMonthStartDay={financialMonthStartDay}
      />
      <HomeCashflow
        income={income}
        expenses={expenses}
        balance={balance}
        currentMonth={currentMonth}
        onMonthChange={onMonthChange}
        financialMonthStartDay={financialMonthStartDay}
      />
      <HomeInsight transactions={transactions} onNavigate={onNavigate} />
      <HomeAccounts accounts={p.accounts || []} />
      <HomeEvolution
        patrimonyTotal={patrimonyTotal}
        income={income}
        balance={balance}
        investments={investments}
        realestate={realestate}
      />
    </div>
  );
};

export default HomeTab;
