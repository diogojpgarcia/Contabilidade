#!/usr/bin/env bash
# cleanup.sh — apagar código morto e commitar
# Corre este script na raiz do projecto: bash cleanup.sh
set -e
cd "$(dirname "$0")"

# Remover lock stale se existir
rm -f .git/index.lock

# Apagar ficheiros JS/JSX mortos
git rm -f \
  src/components/AdvancedAnalytics.jsx \
  src/components/BackupSettings.jsx \
  src/components/CloudSyncButton.jsx \
  src/components/CosmosPlanet.jsx \
  src/components/DefaultTransactionList.jsx \
  src/components/EnhancedTransactionForm.jsx \
  src/components/FinancialOverview.jsx \
  src/components/InsightsPanel.jsx \
  src/components/PasswordLogin.jsx \
  src/components/PasswordSetup.jsx \
  src/components/ProfessionalDashboard.jsx \
  src/components/RecoverySetup.jsx \
  src/components/SmartSuggestions.jsx \
  src/components/TransactionFilters.jsx \
  src/components/TransactionForm.jsx \
  src/components/TransactionList.jsx \
  src/components/UserCard.jsx \
  src/components/cosmos/index.js \
  src/components/home/HomeAccounts.jsx \
  src/components/home/HomeCashflow.jsx \
  src/components/home/HomeEvolution.jsx \
  src/components/home/HomeInsight.jsx \
  src/components/home/HomeQuickActions.jsx \
  src/services/dbService.js \
  src/utils/alerts.js \
  src/utils/auth.js \
  src/utils/categorizeWithClaude.js \
  src/utils/exportUtils.js \
  src/utils/forecasting.js \
  src/utils/stockPrice.js

# Apagar CSS órfão
git rm -f \
  src/App.css \
  src/components/HomeTab.css \
  src/components/InsightsPanel.css \
  src/styles/layout.css

# Incluir as alterações ao App.jsx (import layout.css removido + CosmosBottomNav ligado)
git add src/App.jsx src/components/cosmos/CosmosBottomNav.css

# Commit
git commit -m "refactor: remove dead code, wire CosmosBottomNav

Dead JS/JSX removed (30 files): AdvancedAnalytics, BackupSettings,
CloudSyncButton, CosmosPlanet, DefaultTransactionList,
EnhancedTransactionForm, FinancialOverview, InsightsPanel,
PasswordLogin, PasswordSetup, ProfessionalDashboard, RecoverySetup,
SmartSuggestions, TransactionFilters, TransactionForm, TransactionList,
UserCard, cosmos/index.js, home/{HomeAccounts,HomeCashflow,HomeEvolution,
HomeInsight,HomeQuickActions}, services/dbService, utils/{alerts,auth,
categorizeWithClaude,exportUtils,forecasting,stockPrice}

Orphaned CSS removed (4 files): App.css, HomeTab.css,
InsightsPanel.css, styles/layout.css

App.jsx:
- Remove layout.css import (page-root/page-padded never used)
- Replace inline <nav> + fixed FAB with <CosmosBottomNav>
  (wires the notch fix done in the previous commit)
- CosmosBottomNav items: home, stats, add(center), budget, profile"

git push

echo ""
echo "✅ Concluído. Remove cleanup.sh do projecto se quiseres:"
echo "   git rm cleanup.sh && git commit -m 'chore: remove cleanup script' && git push"
