/**
 * categorizeWithClaude.js
 *
 * Two-stage categorization for imported transactions:
 *   1. Local rules  — instant, no API call, covers the common cases
 *   2. Claude batch — one API call for everything the rules miss
 *
 * Returns transactions with the `category` field set to a professional label
 * (e.g. "Alimentação", "Transporte") matching CATEGORIES_EXPENSE/INCOME.
 *
 * NOTE: enrichTransactions already does its own rule-based categorisation
 * using internal labels ("Alimentacao", "Transportes").  This module maps
 * those results to the professional labels AND handles the remainder with AI.
 */

import { CATEGORIES_EXPENSE, CATEGORIES_INCOME } from './categories-professional';

// Flat list of professional category labels passed to Claude as the allowed set
const CATEGORY_LABELS = [
  ...CATEGORIES_EXPENSE,
  ...CATEGORIES_INCOME,
].map(c => c.label);

// ─── Internal → Professional label bridge ───────────────────────────────────
// enrichTransactions assigns internal labels; map them to the professional ones.
const INTERNAL_TO_PRO = {
  Alimentacao:    'Alimentação',
  Transportes:    'Transporte',
  Entretenimento: 'Lazer & Entretenimento',
  Contas:         'Utilities',
  Financas:       'Serviços Financeiros',
  Saude:          'Saúde',
  Compras:        'Outros',
  Rendimentos:    'Salário Principal',
  Poupanca:       'Investimentos',
  Outros:         null,   // null = needs further matching
};

// ─── Local keyword rules (professional labels) ───────────────────────────────
// Only transactions not already bridged by INTERNAL_TO_PRO pass through here.
// Covers the task's explicit examples plus common extras.
const LOCAL_RULES = [
  // Transport
  { keywords: ['uber', 'bolt', 'cabify', 'taxista', 'taxi', 'tvde'], label: 'Transporte' },
  { keywords: ['galp', 'bp ', 'repsol', 'shell', 'gasolina', 'combustivel'], label: 'Transporte' },
  { keywords: ['via verde', 'viaverde', 'portagem', 'autoestrada'], label: 'Transporte' },
  { keywords: ['cp ', 'comboios', 'metro ', 'carris', 'stcp', 'tap ', 'ryanair', 'easyjet', 'flixbus'], label: 'Transporte' },
  // Food
  { keywords: ['pingo doce', 'pingodoce', 'continente', 'lidl', 'aldi', 'jumbo', 'mercadona', 'intermarche', 'minipreco', 'froiz', 'supermercado'], label: 'Alimentação' },
  { keywords: ['mcdonalds', 'mcdonald', 'burger king', 'kfc', 'subway', 'nandos', 'dominos', 'pizza'], label: 'Alimentação' },
  { keywords: ['glovo', 'ubereats', 'uber eats', 'bolt food', 'just eat', 'takeaway'], label: 'Alimentação' },
  { keywords: ['starbucks', 'pastelaria', 'padaria', 'cafe ', 'cafetaria'], label: 'Alimentação' },
  // Subscriptions / Streaming
  { keywords: ['netflix', 'hbo', 'disney', 'amazon prime', 'primevideo', 'apple tv', 'paramount', 'crunchyroll'], label: 'Subscrições' },
  { keywords: ['spotify', 'apple music', 'youtube premium', 'deezer', 'tidal'], label: 'Subscrições' },
  { keywords: ['microsoft 365', 'office 365', 'icloud', 'google one', 'dropbox'], label: 'Subscrições' },
  // Communications
  { keywords: ['nos ', 'meo ', 'vodafone', 'nowo', 'altice', 'fibra'], label: 'Comunicações' },
  // Health
  { keywords: ['farmacia', 'farmácia', 'clinica', 'clínica', 'hospital', 'medico', 'médico', 'consulta', 'dentista', 'fisioterapia'], label: 'Saúde' },
  // Utilities
  { keywords: ['edp ', 'enel', 'electricidade', 'eletricidade', 'agua ', 'aguas ', 'indaqua', 'gas natural', 'naturgy'], label: 'Utilities' },
  // Financial
  { keywords: ['mbway', 'mbref', 'transferencia', 'sepa wire'], label: 'Serviços Financeiros' },
  { keywords: ['taxa ', 'comissao', 'comissão', 'juros', 'multa', 'imposto'], label: 'Serviços Financeiros' },
  // Shopping
  { keywords: ['zara', 'h&m', 'primark', 'mango', 'bershka', 'stradivarius', 'pull&bear'], label: 'Roupa & Calçado' },
  { keywords: ['fnac', 'worten', 'mediamarkt', 'leroy merlin', 'ikea', 'decathlon'], label: 'Tecnologia' },
  // Travel
  { keywords: ['airbnb', 'booking.com', 'hotels.com', 'aeroporto', 'airport'], label: 'Viagens & Férias' },
  // Income
  { keywords: ['salario', 'salary', 'ordenado', 'vencimento', 'payroll'], label: 'Salário Principal' },
  { keywords: ['subsidio ferias', 'subsidio natal', 'subsidio refeicao'], label: 'Subsídios' },
];

function applyLocalRules(description) {
  const lower = (description || '').toLowerCase();
  for (const rule of LOCAL_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) return rule.label;
  }
  return null;
}

/**
 * categorizeWithClaude(transactions)
 *
 * @param {Array} transactions  Enriched transactions from enrichTransactions()
 *                              Each has: { description, clean_description, amount,
 *                                          category (internal), ... }
 * @returns {Promise<Array>}    Same array with `category` set to professional label
 */
export async function categorizeWithClaude(transactions) {
  if (!transactions.length) return transactions;

  const matched   = [];
  const unmatched = [];

  for (const tx of transactions) {
    // 1. Try internal→professional bridge first (covers enrichTransactions hits)
    const bridged = INTERNAL_TO_PRO[tx.category];
    if (bridged) {
      matched.push({ ...tx, category: bridged });
      continue;
    }

    // 2. Try local keyword rules on the cleaned description
    const ruleLabel = applyLocalRules(tx.clean_description || tx.description);
    if (ruleLabel) {
      matched.push({ ...tx, category: ruleLabel });
      continue;
    }

    // 3. Needs Claude
    unmatched.push(tx);
  }

  if (unmatched.length === 0) return [...matched];

  // ── ONE Claude API call for all unmatched transactions ──────────────────
  try {
    const res = await fetch('/api/categorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        transactions: unmatched.map(t => ({
          description: t.clean_description || t.description,
          amount: t.amount,
        })),
        categories: CATEGORY_LABELS,
      }),
    });

    if (res.ok) {
      const enriched = await res.json();
      const claudeResults = unmatched.map((tx, i) => ({
        ...tx,
        category:          enriched[i]?.category          || 'Outros',
        clean_description: enriched[i]?.description       || tx.clean_description,
      }));
      return [...matched, ...claudeResults];
    }

    console.warn('[categorizeWithClaude] API call failed, status:', res.status);
  } catch (err) {
    console.warn('[categorizeWithClaude] API call threw, keeping existing categories:', err.message);
  }

  // Fallback: keep unmatched with 'Outros'
  return [...matched, ...unmatched.map(tx => ({ ...tx, category: 'Outros' }))];
}
