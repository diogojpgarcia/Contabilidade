.home-tab {
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  animation: fadeIn 0.3s ease;
}

/* Month Navigation */
.month-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.month-display-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.month-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.month-nav-btn {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.month-nav-btn:active {
  transform: scale(0.95);
  background: var(--bg-tertiary);
}

.btn-current-month {
  padding: 0.375rem 0.75rem;
  border-radius: 8px;
  background: var(--primary);
  color: white;
  border: none;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-current-month:active {
  transform: scale(0.95);
  opacity: 0.8;
}

/* Balance Hero Card */
.balance-hero {
  background: var(--gradient-1);
  border-radius: 24px;
  padding: 2rem 1.5rem;
  text-align: center;
  box-shadow: 0 12px 40px rgba(99, 102, 241, 0.3);
  position: relative;
  overflow: hidden;
}

.balance-hero::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-20px, -20px); }
}

.balance-hero.negative {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  box-shadow: 0 12px 40px rgba(239, 68, 68, 0.3);
}

.balance-label {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.balance-amount {
  font-size: 3rem;
  font-weight: 800;
  color: white;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  margin-bottom: 0.5rem;
  position: relative;
}

.balance-subtext {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

/* Mini Cards */
.mini-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.mini-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.2s ease;
}

.mini-card:active {
  transform: scale(0.98);
  background: var(--bg-tertiary);
}

.mini-card-icon {
  font-size: 2rem;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.mini-card-content {
  flex: 1;
}

.mini-card-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.mini-card-value {
  font-size: 1.25rem;
  font-weight: 700;
}

.income-card .mini-card-value {
  color: var(--success);
}

.expense-card .mini-card-value {
  color: var(--danger);
}

/* Recent Section */
.recent-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 1.5rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-title::before {
  content: '';
  width: 4px;
  height: 20px;
  background: var(--gradient-1);
  border-radius: 2px;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state p {
  margin: 0.5rem 0;
}

.empty-subtext {
  font-size: 0.875rem;
  opacity: 0.7;
}

/* Transactions List */
.transactions-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.transaction-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: all 0.2s ease;
}

.transaction-item:active {
  transform: translateX(4px);
  background: var(--bg-tertiary);
}

.transaction-left {
  flex: 1;
  min-width: 0;
}

.transaction-category {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.transaction-description {
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.transaction-amount {
  font-size: 1rem;
  font-weight: 700;
  white-space: nowrap;
}

.transaction-amount.income {
  color: var(--success);
}

.transaction-amount.expense {
  color: var(--danger);
}

/* Responsive */
@media (max-width: 375px) {
  .balance-amount {
    font-size: 2.5rem;
  }
  
  .mini-cards {
    gap: 0.75rem;
  }
  
  .mini-card {
    padding: 1rem;
  }
}
