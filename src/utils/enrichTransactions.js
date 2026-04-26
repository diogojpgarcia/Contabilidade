// enrichTransactions.js
// Input:  [{date, description, amount}]  (amount already signed)
// Output: { transactions: [...], insights: {...} }

const RULES = [
  { category: 'Rendimentos', subcategory: 'Salario',
    keywords: ['salary','salario','ordenado','payroll','vencimento','remuneracao','wages',
               'subsidio refeicao','subsidio ferias','subsidio natal','pagamento salarial'] },
  { category: 'Rendimentos', subcategory: 'Extras',
    keywords: ['freelance','invoice','honorarios','recibo','upwork','fiverr',
               'bolsa','scholarship','rendimento'] },
  { category: 'Poupanca', subcategory: 'Investimentos',
    keywords: ['investimento','etf','acoes','fundo investimento','trading','xtb','degiro',
               'interactive brokers','bison bank'] },
  { category: 'Poupanca', subcategory: 'Poupanca',
    keywords: ['poupanca','deposito prazo','certificado aforro','saving'] },
  { category: 'Alimentacao', subcategory: 'Supermercado',
    keywords: ['continente','pingo doce','pingodoce','lidl','aldi','intermarche','minipreco',
               'mercadona','jumbo','froiz','celeiro','meu super','apolonia','supermercado',
               'grocery','supermarket','kaufland','rewe','edeka','carrefour','auchan','leclerc',
               'mercado','talho','peixaria','frutaria'] },
  { category: 'Alimentacao', subcategory: 'Restaurantes',
    keywords: ['mcdonalds','mcdonald','burger king','burgerking','kfc','pizza hut','pizzahut',
               'subway','nandos','dominos','telepizza','pizzeria','sushi','tasca','taberna',
               'restaurante','restaurant','takeaway','glovo','ubereats','uber eats','bolt food',
               'just eat','delivery','snack bar','fast food'] },
  { category: 'Alimentacao', subcategory: 'Cafes',
    keywords: ['starbucks','cafe','pastelaria','padaria','snack','coffee'] },
  { category: 'Transportes', subcategory: 'TVDE',
    keywords: ['uber','bolt','cabify','taxista','taxi','tvde'] },
  { category: 'Transportes', subcategory: 'Combustivel',
    keywords: ['gasolina','galp','repsol','shell','esso','cepsa','bp','combustivel','fuel'] },
  { category: 'Transportes', subcategory: 'Publicos',
    keywords: ['cp ','comboios','metro ','carris','stcp','renfe','sncf','flixbus',
               'ryanair','easyjet','tap ','airport','aeroporto','autocarro','ferry','barco',
               'portagem','autoestrada','via verde','viaverde','parking','estacionamento'] },
  { category: 'Compras', subcategory: 'Online',
    keywords: ['amazon','aliexpress','shein','ebay','shopify','asos','wish','etsy'] },
  { category: 'Compras', subcategory: 'Fisica',
    keywords: ['zara','h&m','hm','primark','mango','bershka','pull&bear','stradivarius',
               'fnac','worten','mediamarkt','leroy merlin','ikea','sport zone','decathlon',
               'el corte ingles','corte ingles','wells','parfois','compras'] },
  { category: 'Entretenimento', subcategory: 'Streaming',
    keywords: ['netflix','spotify','hbo','disney','apple music','youtube','deezer','tidal',
               'primevideo','amazon prime','crunchyroll','twitch','icloud','google one',
               'microsoft 365','office 365','dropbox','apple tv','paramount'] },
  { category: 'Entretenimento', subcategory: 'Jogos',
    keywords: ['xbox','playstation','steam','epic games','gaming','nintendo','ea games',
               'ubisoft','riot games','blizzard'] },
  { category: 'Entretenimento', subcategory: 'Eventos',
    keywords: ['cinema','teatro','concert','festival','bilhete','ticketline','museu','galeria',
               'bowling','escape room','karting','piscina','ginasio','gym','fitness','patreon'] },
  { category: 'Contas', subcategory: 'Eletricidade',
    keywords: ['edp','enel','edf','eletricidade','electricity'] },
  { category: 'Contas', subcategory: 'Agua',
    keywords: ['agua ','aguas ','indaqua','smas'] },
  { category: 'Contas', subcategory: 'Internet',
    keywords: ['nos ','meo ','vodafone','nowo','altice','internet','fibra'] },
  { category: 'Contas', subcategory: 'Telemovel',
    keywords: ['tmn ','t-mobile','orange ','swisscom','telemovel','telecom'] },
  { category: 'Contas', subcategory: 'Outros',
    keywords: ['gas natural','naturgy','galp energia','renda','aluguer','condominio',
               'seguro','insurance','hipoteca','mortgage','imt'] },
  { category: 'Financas', subcategory: 'Transferencias',
    keywords: ['transferencia','mbway','mbref','trf ','sepa','wire'] },
  { category: 'Financas', subcategory: 'Levantamentos',
    keywords: ['atm ','levantamento','multibanco','withdrawal'] },
  { category: 'Financas', subcategory: 'Taxas',
    keywords: ['taxa','comissao','fee ','multa','imposto','irs','tarifa','juros'] },
  { category: 'Saude', subcategory: 'Farmacia',
    keywords: ['farmacia','pharmacy'] },
  { category: 'Saude', subcategory: 'Clinicas',
    keywords: ['hospital','clinica','medico','dentista','otica','laboratorio','analises',
               'consulta','saude','dr ','dra ','fisioterapia','psicologia',
               'nutricao','centro de saude','sns','unidade saude'] },
];

const NOISE = [
  /\b[A-Z0-9]{8,}\b/g,
  /\*{2,}[\d*]+/g,
  /\b\d{4}[\s-]\d{4}[\s-]\d{4}\b/g,
  /\bPT\d{2,}\b/gi,
  /\b\d{6,}\b/g,
  /\b(mbway|mbref|ref|nif|iban|bic|swift)\b/gi,
  /\b(compra|pagamento|debito direto|dd |trf |pos )\b/gi,
  /\d{2}[/-]\d{2}[/-]\d{2,4}/g,
  /\s{2,}/g,
];

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function daysBetween(a, b) {
  return Math.abs(new Date(a) - new Date(b)) / 86400000;
}

export function cleanDescription(raw) {
  if (!raw) return 'desconhecido';
  let s = String(raw);
  for (const p of NOISE) s = s.replace(p, ' ');
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  return s || 'desconhecido';
}

export function categorize(description, amount) {
  const d = norm(description);
  for (const rule of RULES) {
    if (rule.keywords.some(kw => d.includes(norm(kw)))) {
      return { category: rule.category, subcategory: rule.subcategory };
    }
  }
  if (amount > 0) return { category: 'Rendimentos', subcategory: 'Extras' };
  return { category: 'Outros', subcategory: 'Outros' };
}

function merchantKey(clean) {
  return clean.split(' ').slice(0, 2).join(' ');
}

function detectSubscriptions(transactions) {
  const tagged = new Set();
  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const a = transactions[i];
      const b = transactions[j];
      if (a.amount >= 0 || b.amount >= 0) continue;
      if (merchantKey(a.clean_description) !== merchantKey(b.clean_description)) continue;
      const amtA = Math.abs(a.amount);
      const amtB = Math.abs(b.amount);
      if (amtA === 0 || amtB === 0) continue;
      if (Math.abs(amtA - amtB) / Math.max(amtA, amtB) > 0.05) continue;
      const days = daysBetween(a.date, b.date);
      if (days < 25 || days > 40) continue;
      tagged.add(i);
      tagged.add(j);
    }
  }
  return transactions.map((tx, i) => ({ ...tx, is_subscription: tagged.has(i) }));
}

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
      const ka = norm(a.clean_description).slice(0, 6);
      const kb = norm(b.clean_description).slice(0, 6);
      if (ka === kb && ka.length >= 3) flagged.add(j);
    }
  }
  return transactions.map((tx, i) => ({ ...tx, is_duplicate: flagged.has(i) }));
}

function computeInsights(transactions) {
  let total_spent      = 0;
  let total_income     = 0;
  let shopping_spent   = 0;
  let savings_amount   = 0;
  let subscriptions_count = 0;
  let duplicate_count  = 0;
  const catTotals = {};

  for (const tx of transactions) {
    if (tx.is_duplicate) { duplicate_count++; continue; }
    if (tx.is_subscription) subscriptions_count++;
    if (tx.amount < 0) {
      const abs = Math.abs(tx.amount);
      total_spent += abs;
      catTotals[tx.category] = (catTotals[tx.category] || 0) + abs;
      if (tx.category === 'Compras') shopping_spent += abs;
    } else {
      total_income += tx.amount;
      if (tx.category === 'Poupanca') savings_amount += tx.amount;
    }
  }

  const top_category   = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Outros';
  const shopping_ratio = total_spent  > 0 ? shopping_spent  / total_spent  : 0;
  const savings_rate   = total_income > 0 ? savings_amount  / total_income : 0;
  const raw_score = 100 - 2 * subscriptions_count - 20 * shopping_ratio + 30 * savings_rate;
  const score = Math.round(Math.min(100, Math.max(0, raw_score)));

  return {
    total_spent:         parseFloat(total_spent.toFixed(2)),
    total_income:        parseFloat(total_income.toFixed(2)),
    top_category,
    subscriptions_count,
    duplicate_count,
    score,
  };
}

export function enrichTransactions(rawTransactions) {
  if (!Array.isArray(rawTransactions) || rawTransactions.length === 0) {
    return {
      transactions: [],
      insights: {
        total_spent: 0, total_income: 0, top_category: 'Outros',
        subscriptions_count: 0, duplicate_count: 0, score: 100,
      },
    };
  }

  const enriched = rawTransactions.map(tx => {
    const clean = cleanDescription(tx.description);
    const { category, subcategory } = categorize(tx.description, tx.amount);
    return {
      date:              tx.date,
      description:       tx.description,
      clean_description: clean,
      amount:            tx.amount,
      category,
      subcategory,
      is_subscription:   false,
      is_duplicate:      false,
    };
  });

  const withSubs  = detectSubscriptions(enriched);
  const withDupes = detectDuplicates(withSubs);
  const insights  = computeInsights(withDupes);

  return { transactions: withDupes, insights };
}