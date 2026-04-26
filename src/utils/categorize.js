export const RULES = [
  {
    key: 'supermercado', label: 'Alimentação',
    keywords: [
      'continente','lidl','pingo doce','pingodoce','aldi','intermarche','intermarch',
      'minipreco','mercadona','pingo','jumbo','froiz','celeiro','meu super','apolonia',
      'grocery','supermarket','kaufland','rewe','edeka','carrefour','auchan','leclerc',
    ]
  },
  {
    key: 'restaurante', label: 'Alimentação',
    keywords: [
      'mcdonalds','burger king','burgerking','kfc','pizza hut','pizzahut','subway',
      'starbucks','restaurant','restaurante','cafe ','pastelaria','padaria','snack',
      'takeaway','delivery','glovo','ubereats','uber eats','bolt food','just eat',
      'dominos','domino','telepizza','nandos','mcdonald',
    ]
  },
  {
    key: 'transporte', label: 'Transporte',
    keywords: [
      'uber','bolt','cabify','gasolina','galp','bp ','repsol','shell','esso','cepsa',
      'combustivel','portagem','cp ','comboios','metro ','carris','stcp','transport',
      'autoestrada','via verde','viaverde','parking','estacionamento','parque',
      'renfe','sncf','flixbus','ryanair','easyjet','tap ','airport','aeroporto',
    ]
  },
  {
    key: 'subscricoes', label: 'Subscrições',
    keywords: [
      'netflix','spotify','youtube','amazon prime','hbo','disney+','disney plus',
      'apple music','icloud','google one','microsoft 365','office 365','dropbox',
      'notion','chatgpt','openai','twitch','patreon','adobe','subscription',
      'xbox game pass','playstation plus','deezer','tidal','primevideo',
    ]
  },
  {
    key: 'lazer', label: 'Lazer & Entretenimento',
    keywords: [
      'cinema','teatro','concert','festival','bilhete','ticketline','sport',
      'ginasio','gym ','fitness','piscina','bowling','escape room','karting',
      'fnac','worten','livraria','playstation','xbox','steam','epic games','gaming',
    ]
  },
  {
    key: 'saude', label: 'Saúde',
    keywords: [
      'farmacia','pharmacy','hospital','clinica','medico','dentista','otica',
      'wells','dr. ','laboratorio','analises','consulta','saude','health',
    ]
  },
  {
    key: 'comunicacoes', label: 'Comunicações',
    keywords: [
      'nos ','meo ','vodafone','nowo','altice','internet','telemovel','telecom',
      'orange ','swisscom','telenet','tmn ','t-mobile',
    ]
  },
  {
    key: 'habitacao', label: 'Habitação',
    keywords: [
      'renda','aluguer','condominio','agua ','eletricidade','edf ','enel ','edp ',
      'naturgy','gas natural','rent ','mortgage','hipoteca','ikea','leroy merlin',
    ]
  },
  {
    key: 'salario', label: 'Salário Principal',
    keywords: [
      'salary','salario','ordenado','payroll','vencimento','remuneracao',
      'pagamento salarial','payslip','wages','subsidio refeicao',
    ]
  },
  {
    key: 'freelance', label: 'Trabalho Extra / Freelance',
    keywords: [
      'freelance','invoice','fatura','honorarios','recibo','upwork','fiverr',
    ]
  },
];

const FALLBACK = { key: 'outros', label: 'Outros' };

function normDesc(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function categorizeTransaction(description, type) {
  const d = normDesc(description);
  for (const rule of RULES) {
    if (type === 'income' && !['salario','freelance'].includes(rule.key)) continue;
    if (type === 'expense' && ['salario','freelance'].includes(rule.key)) continue;
    if (rule.keywords.some(kw => d.includes(normDesc(kw)))) {
      return { key: rule.key, label: rule.label };
    }
  }
  if (type === 'income') return { key: 'outros_rendimentos', label: 'Outros Rendimentos' };
  return FALLBACK;
}

export function categorizeBatch(transactions) {
  return transactions.map(tx => {
    if (tx.category && tx.category !== 'Outros' && tx.category !== 'Outros Rendimentos') return tx;
    const cat = categorizeTransaction(tx.description, tx.type);
    return { ...tx, category: cat.label, categoryKey: cat.key };
  });
}
