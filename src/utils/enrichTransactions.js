// ─── Transaction Enrichment Pipeline ─────────────────────────────────────────
// Input:  raw parsed transactions [{date, description, amount, type}]
// Output: { transactions: [...enriched], insights: {...} }
// ─────────────────────────────────────────────────────────────────────────────

// ── Category definitions ──────────────────────────────────────────────────────
const CATEGORIES = [
  {
    key: 'Food',
    keywords: [
      'continente','pingo doce','pingodoce','lidl','aldi','intermarche','minipreco',
      'mercadona','jumbo','froiz','celeiro','meu super','apolonia','supermercado',
      'grocery','supermarket','kaufland','rewe','edeka','carrefour','auchan','leclerc',
      'mcdonalds','mcdonald','burger king','burgerking','kfc','pizza hut','pizzahut',
      'subway','starbucks','restaurant','restaurante','cafe','pastelaria','padaria',
      'snack','takeaway','delivery','glovo','ubereats','uber eats','bolt food',
      'just eat','dominos','telepizza','nandos','pizzeria','sushi','tasca','taberna',
      'mercado','talho','peixaria','frutaria','horeca','snack bar','fast food',
    ],
  },
  {
    key: 'Transport',
    keywords: [
      'uber','bolt','cabify','gasolina','galp','repsol','shell','esso','cepsa','bp',
      'combustivel','portagem','autoestrada','via verde','viaverde','parking',
      'estacionamento','parque','cp ','comboios','metro ','carris','stcp',
      'renfe','sncf','flixbus','ryanair','easyjet','tap ','airport','aeroporto',
      'transporte','taxista','taxi','autocarro','ferry','barco','rent a car',
    ],
  },
  {
    key: 'Shopping',
    keywords: [
      'amazon','zara','h&m','hm','primark','mango','bershka','pull&bear','stradivarius',
      'fnac','worten','mediamarkt','leroy merlin','ikea','sport zone','decathlon',
      'el corte ingles','corte ingles','auchan','continente modelo','wells','parfois',
      'shein','aliexpress','ebay','shopify','online shopping','compras',
    ],
  },
  {
    key: 'Bills',
    keywords: [
      'edp','enel','edf','agua ','aguas ','gas natural','naturgy','galp energia',
      'nos ','meo ','vodafone','nowo','altice','internet','telecom','telemovel',
      'orange ','swisscom','tmn ','t-mobile','renda','aluguer','condominio',
      'seguro','insurance','hipoteca','mortgage','imt','fiancas','caixa','cgd',
      'millennium','santander','novobanco','bpi ','irs','at ','autoridade tributaria',
      'imposto','taxa','multa','tarifa','servico','serv ',
    ],
  },
  {
    key: 'Entertainment',
    keywords: [
      'netflix','spotify','youtube','hbo','disney','apple music','icloud','google one',
      'microsoft 365','office 365','dropbox','notion','chatgpt','openai','twitch',
      'patreon','adobe','xbox','playstation','steam','epic games','gaming','deezer',
      'tidal','primevideo','amazon prime','crunchyroll','cinema','teatro','concert',
      'festival','bilhete','ticketline','sport zone gym','ginasio','gym','fitness',
      'piscina','bowling','escape room','karting','museu','galeria',
    ],
  },
  {
    key: 'Health',
    keywords: [
      'farmacia','pharmacy','hospital','clinica','medico','dentista','otica',
      'laboratorio','analises','consulta','saude','health','dr ','dra ','enfermeiro',
      'fisioterapia','psicologia','nutricao','centro de saude','sns','unidade saude',
    ],
  },
  {
    key: 'Income',
    keywords: [
      'salary','salario','ordenado','payroll','vencimento','remuneracao','wages',
      'subsidio refeicao','subsidio ferias','subsidio natal','pagamento salarial',
      'freelance','invoice','honorarios','recibo','upwork','fiverr','transferencia',
      'deposito','rendimento','pension','reforma','bolsa','scholarship',
    ],
  },
];

// ── Description noise patterns to remove ─────────────────────────────────────
// Order matters: more specific patterns first.
const NOISE_PATTERNS = [
  /\b[A-Z0-9]{6,}\b/g,               // uppercase codes: XABC12, REF29847
  /\*{2,}[\d*]+/g,                    // masked card: ****1234
  /\b\d{4}[\s\-]\d{4}[\s\-]\d{4}\b/g, // card-like: 1234 5678 9012
  /\bPT\d{2,}\b/gi,                   // PT reference numbers
  /\b\d{5,}\b/g,                      // long numeric sequences
  /\b(mbway|mbref|ref|nif|iban|bic|swift)\b/gi,
  /\b(compra|pagamento|transferencia|debito direto|dd |trf |atm |pos )\b/gi,
  /\d{2}[-\/]\d{2}[-\/]\d{2,4}/g,    // dates within description
  /\s{2,}/g,                          // multiple spaces → single space
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function normText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function daysBetween(dateA, dateB) {
  return Math.abs(new Date(dateA) - new Date(dateB)) / 86_400_000;
}

// ── Description cleaner ───────────────────────────────────────────────────────
export function cleanDescription(raw) {
  if (!raw) return 'Unknown transaction';
  let s = String(raw);
  for (const pattern of NOISE_PATTERNS) {
    s = s.replace(pattern, ' ');
  }
  // Title-case the result
  s = s.trim().replace(/\s+/g, ' ');
  if (!s) return 'Unknown transaction';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ── Categorizer ───────────────────────────────────────────────────────────────
export function categorize(description, type) {
  // Income type always considered first — but keyword match overrides
  if (type === 'income') {
    const d = normText(description);
    for (const cat of CATEGORIES) {
      if (cat.key === 'Income' && cat.keywords.some(kw => d.includes(normText(kw)))) {
        return 'Income';
      }
    }
  }
  const d = normText(description);
  for (const cat of CATEGORIES) {
    if (cat.keywords.some(kw => d.includes(normText(kw)))) {
      return cat.key;
    }
  }
  return type === 'income' ? 'Income' : 'Other';
}

// ── Duplicate detector ────────────────────────────────────────────────────────
// Two transactions are duplicates if:
//   1. Same amount (exact)
//   2. First 10 chars of normalised description match
//   3. Dates within 2 days of each other
function detectDuplicates(transactions) {
  const flagged = new Set();

  for (let i = 0; i < transactions.length; i++) {
    if (flagged.has(i)) continue;
    for (let j = i + 1; j < transactions.length; j++) {
      if (flagged.has(j)) continue;
      const a = transactions[i];
      const b = transactions[j];
      if (a.amount !== b.amount) continue;
      if (daysBetween(a.date, b.date) > 2) continue;
      const descA = normText(a.clean_description).slice(0, 10);
      const descB = normText(b.clean_description).slice(0, 10);
      if (descA === descB && descA.length >= 3) {
        // Keep the first occurrence; mark subsequent ones as duplicate
        flagged.add(j);
      }
    }
  }

  return transactions.map((tx, i) => ({ ...tx, is_duplicate: flagged.has(i) }));
}

// ── Insights calculator ───────────────────────────────────────────────────────
function computeInsights(transactions) {
  let total_spent  = 0;
  let total_income = 0;
  const categoryTotals = {};

  for (const tx of transactions) {
    if (tx.is_duplicate) continue; // exclude duplicates from totals
    if (tx.type === 'expense') {
      total_spent += tx.amount;
      categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
    } else {
      total_income += tx.amount;
    }
  }

  const top_category = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Other';

  const duplicate_count = transactions.filter(tx => tx.is_duplicate).length;

  return {
    total_spent:     parseFloat(total_spent.toFixed(2)),
    total_income:    parseFloat(total_income.toFixed(2)),
    top_category,
    duplicate_count,
  };
}

// ── Main enrichment function ──────────────────────────────────────────────────
// Input:  [{date, description, amount, type, category?}]
// Output: { transactions: [...], insights: {...} }
export function enrichTransactions(rawTransactions) {
  if (!Array.isArray(rawTransactions) || rawTransactions.length === 0) {
    return { transactions: [], insights: { total_spent: 0, total_income: 0, top_category: 'Other', duplicate_count: 0 } };
  }

  // Step 1 — clean + categorize
  const enriched = rawTransactions.map(tx => {
    const clean = cleanDescription(tx.description);
    const cat   = categorize(tx.description, tx.type);
    return {
      date:              tx.date,
      description:       tx.description,
      clean_description: clean,
      amount:            tx.amount,            // never modified — rule: DO NOT change amounts
      type:              tx.type,
      category:          cat,
      is_duplicate:      false,                // set in step 2
    };
  });

  // Step 2 — mark duplicates
  const withDuplicates = detectDuplicates(enriched);

  // Step 3 — compute insights
  const insights = computeInsights(withDuplicates);

  return { transactions: withDuplicates, insights };
}
