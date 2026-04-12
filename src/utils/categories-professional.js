/**
 * Professional Category System
 * 30+ categories with subcategories, icons, and colors
 */

// ============================================
// EXPENSE CATEGORIES (20+)
// ============================================

export const CATEGORIES_EXPENSE = [
  {
    id: "habitacao",
    label: "Habitação",
    icon: "🏠",
    color: "#5B8DEF",
    subcategories: [
      { id: "renda", label: "Renda/Prestação" },
      { id: "condominio", label: "Condomínio" },
      { id: "manutencao", label: "Manutenção" },
      { id: "decoracao", label: "Decoração" }
    ]
  },
  {
    id: "alimentacao",
    label: "Alimentação",
    icon: "🍽️",
    color: "#E8734A",
    subcategories: [
      { id: "supermercado", label: "Supermercado" },
      { id: "restaurantes", label: "Restaurantes" },
      { id: "takeaway", label: "Takeaway" },
      { id: "cafes", label: "Cafés/Pastelarias" }
    ]
  },
  {
    id: "transporte",
    label: "Transporte",
    icon: "🚗",
    color: "#F5B731",
    subcategories: [
      { id: "combustivel", label: "Combustível" },
      { id: "publicos", label: "Transportes Públicos" },
      { id: "estacionamento", label: "Estacionamento" },
      { id: "portagens", label: "Portagens" },
      { id: "manutencao", label: "Manutenção Carro" },
      { id: "uber", label: "Uber/Bolt" }
    ]
  },
  {
    id: "saude",
    label: "Saúde",
    icon: "💊",
    color: "#4ECDC4",
    subcategories: [
      { id: "farmacia", label: "Farmácia" },
      { id: "medicos", label: "Consultas Médicas" },
      { id: "seguro", label: "Seguro Saúde" },
      { id: "exames", label: "Exames" },
      { id: "dentista", label: "Dentista" }
    ]
  },
  {
    id: "educacao",
    label: "Educação",
    icon: "🎓",
    color: "#34D399",
    subcategories: [
      { id: "propinas", label: "Propinas" },
      { id: "livros", label: "Livros/Material" },
      { id: "cursos", label: "Cursos/Formações" },
      { id: "explicacoes", label: "Explicações" }
    ]
  },
  {
    id: "comunicacoes",
    label: "Comunicações",
    icon: "📱",
    color: "#60A5FA",
    subcategories: [
      { id: "telemovel", label: "Telemóvel" },
      { id: "internet", label: "Internet" },
      { id: "tv", label: "TV/Cabo" }
    ]
  },
  {
    id: "utilities",
    label: "Utilities",
    icon: "⚡",
    color: "#FBBF24",
    subcategories: [
      { id: "agua", label: "Água" },
      { id: "luz", label: "Eletricidade" },
      { id: "gas", label: "Gás" }
    ]
  },
  {
    id: "roupa",
    label: "Roupa & Calçado",
    icon: "👕",
    color: "#F472B6",
    subcategories: [
      { id: "roupa", label: "Roupa" },
      { id: "calcado", label: "Calçado" },
      { id: "acessorios", label: "Acessórios" }
    ]
  },
  {
    id: "tecnologia",
    label: "Tecnologia",
    icon: "💻",
    color: "#8B5CF6",
    subcategories: [
      { id: "equipamento", label: "Equipamento" },
      { id: "software", label: "Software/Apps" },
      { id: "reparacoes", label: "Reparações" }
    ]
  },
  {
    id: "subscricoes",
    label: "Subscrições",
    icon: "📺",
    color: "#EC4899",
    subcategories: [
      { id: "streaming", label: "Streaming (Netflix, etc)" },
      { id: "musica", label: "Música (Spotify, etc)" },
      { id: "ginasio", label: "Ginásio" },
      { id: "outras", label: "Outras" }
    ]
  },
  {
    id: "lazer",
    label: "Lazer & Entretenimento",
    icon: "🎭",
    color: "#A78BFA",
    subcategories: [
      { id: "cinema", label: "Cinema/Teatro" },
      { id: "hobbies", label: "Hobbies" },
      { id: "eventos", label: "Eventos/Concertos" },
      { id: "desporto", label: "Desporto" }
    ]
  },
  {
    id: "viagens",
    label: "Viagens & Férias",
    icon: "✈️",
    color: "#14B8A6",
    subcategories: [
      { id: "voos", label: "Voos" },
      { id: "alojamento", label: "Alojamento" },
      { id: "atividades", label: "Atividades" },
      { id: "diversos", label: "Diversos" }
    ]
  },
  {
    id: "presentes",
    label: "Presentes & Doações",
    icon: "🎁",
    color: "#F59E0B",
    subcategories: [
      { id: "presentes", label: "Presentes" },
      { id: "doacoes", label: "Doações" },
      { id: "caridade", label: "Caridade" }
    ]
  },
  {
    id: "financeiros",
    label: "Serviços Financeiros",
    icon: "🏦",
    color: "#6366F1",
    subcategories: [
      { id: "banco", label: "Comissões Bancárias" },
      { id: "seguros", label: "Seguros" },
      { id: "creditos", label: "Créditos/Empréstimos" },
      { id: "investimentos", label: "Investimentos" }
    ]
  },
  {
    id: "animais",
    label: "Animais de Estimação",
    icon: "🐕",
    color: "#84CC16",
    subcategories: [
      { id: "comida", label: "Comida" },
      { id: "veterinario", label: "Veterinário" },
      { id: "acessorios", label: "Acessórios" }
    ]
  },
  {
    id: "criancas",
    label: "Crianças & Família",
    icon: "👶",
    color: "#FB923C",
    subcategories: [
      { id: "creche", label: "Creche/Ama" },
      { id: "roupa", label: "Roupa Infantil" },
      { id: "brinquedos", label: "Brinquedos" },
      { id: "atividades", label: "Atividades" }
    ]
  },
  {
    id: "cuidados_pessoais",
    label: "Cuidados Pessoais",
    icon: "💅",
    color: "#D946EF",
    subcategories: [
      { id: "cabeleireiro", label: "Cabeleireiro" },
      { id: "estetica", label: "Estética" },
      { id: "produtos", label: "Produtos" }
    ]
  },
  {
    id: "casa_jardim",
    label: "Casa & Jardim",
    icon: "🏡",
    color: "#22C55E",
    subcategories: [
      { id: "moveis", label: "Móveis" },
      { id: "eletrodomesticos", label: "Eletrodomésticos" },
      { id: "jardim", label: "Jardim" },
      { id: "limpeza", label: "Produtos Limpeza" }
    ]
  },
  {
    id: "impostos",
    label: "Impostos & Taxas",
    icon: "💰",
    color: "#EF4444",
    subcategories: [
      { id: "irs", label: "IRS" },
      { id: "imi", label: "IMI" },
      { id: "iuc", label: "IUC" },
      { id: "taxas", label: "Outras Taxas" }
    ]
  },
  {
    id: "emergencias",
    label: "Emergências",
    icon: "🚨",
    color: "#DC2626",
    subcategories: [
      { id: "medicas", label: "Médicas" },
      { id: "reparacoes", label: "Reparações Urgentes" },
      { id: "outras", label: "Outras" }
    ]
  },
  {
    id: "outros",
    label: "Outros",
    icon: "📦",
    color: "#9CA3AF",
    subcategories: [
      { id: "diversos", label: "Diversos" }
    ]
  }
];

// ============================================
// INCOME CATEGORIES (10+)
// ============================================

export const CATEGORIES_INCOME = [
  {
    id: "salario",
    label: "Salário Principal",
    icon: "💰",
    color: "#34D399",
    subcategories: [
      { id: "liquido", label: "Salário Líquido" },
      { id: "bonus", label: "Bónus" },
      { id: "horas_extra", label: "Horas Extra" }
    ]
  },
  {
    id: "subsidios",
    label: "Subsídios",
    icon: "💵",
    color: "#10B981",
    subcategories: [
      { id: "ferias", label: "Subsídio de Férias" },
      { id: "natal", label: "Subsídio de Natal" },
      { id: "alimentacao", label: "Subsídio de Alimentação" },
      { id: "outros", label: "Outros Subsídios" }
    ]
  },
  {
    id: "freelance",
    label: "Trabalho Extra / Freelance",
    icon: "💼",
    color: "#60A5FA",
    subcategories: [
      { id: "consultoria", label: "Consultoria" },
      { id: "projetos", label: "Projetos" },
      { id: "trabalhos", label: "Trabalhos Pontuais" }
    ]
  },
  {
    id: "investimentos",
    label: "Investimentos",
    icon: "📈",
    color: "#A78BFA",
    subcategories: [
      { id: "dividendos", label: "Dividendos" },
      { id: "juros", label: "Juros" },
      { id: "mais_valias", label: "Mais-Valias" },
      { id: "cripto", label: "Criptomoedas" }
    ]
  },
  {
    id: "rendas",
    label: "Rendas Recebidas",
    icon: "🏠",
    color: "#14B8A6",
    subcategories: [
      { id: "imoveis", label: "Imóveis" },
      { id: "equipamento", label: "Equipamento" }
    ]
  },
  {
    id: "reembolsos",
    label: "Reembolsos",
    icon: "💳",
    color: "#F59E0B",
    subcategories: [
      { id: "irs", label: "IRS" },
      { id: "despesas", label: "Despesas" },
      { id: "seguros", label: "Seguros" },
      { id: "outros", label: "Outros" }
    ]
  },
  {
    id: "vendas",
    label: "Vendas",
    icon: "🛍️",
    color: "#EC4899",
    subcategories: [
      { id: "usados", label: "Artigos Usados" },
      { id: "produtos", label: "Produtos" },
      { id: "servicos", label: "Serviços" }
    ]
  },
  {
    id: "premios",
    label: "Prémios & Sorteios",
    icon: "🎰",
    color: "#8B5CF6",
    subcategories: [
      { id: "lotaria", label: "Lotaria/Euromilhões" },
      { id: "sorteios", label: "Sorteios" },
      { id: "premios", label: "Prémios" }
    ]
  },
  {
    id: "prendas",
    label: "Prendas & Doações Recebidas",
    icon: "🎁",
    color: "#F472B6",
    subcategories: [
      { id: "familia", label: "Família" },
      { id: "amigos", label: "Amigos" },
      { id: "outras", label: "Outras" }
    ]
  },
  {
    id: "outros_rendimentos",
    label: "Outros Rendimentos",
    icon: "💸",
    color: "#9CA3AF",
    subcategories: [
      { id: "diversos", label: "Diversos" }
    ]
  }
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function getCategoryById(categoryId, type = 'expense') {
  const categories = type === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;
  return categories.find(cat => cat.id === categoryId) || categories[categories.length - 1];
}

export function getSubcategoryLabel(categoryId, subcategoryId, type = 'expense') {
  const category = getCategoryById(categoryId, type);
  if (!category || !category.subcategories) return null;
  
  const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
  return subcategory ? subcategory.label : null;
}

export function getAllCategories(type = 'expense') {
  return type === 'income' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;
}

export function getCategoryColor(categoryId, type = 'expense') {
  const category = getCategoryById(categoryId, type);
  return category ? category.color : '#9CA3AF';
}

export function getCategoryIcon(categoryId, type = 'expense') {
  const category = getCategoryById(categoryId, type);
  return category ? category.icon : '📦';
}

// Category stats
export function getCategoryStats(transactions, categoryId, monthKey) {
  const categoryTransactions = transactions.filter(
    t => t.category === categoryId && t.date.startsWith(monthKey)
  );
  
  return {
    count: categoryTransactions.length,
    total: categoryTransactions.reduce((sum, t) => sum + t.amount, 0),
    average: categoryTransactions.length > 0 
      ? categoryTransactions.reduce((sum, t) => sum + t.amount, 0) / categoryTransactions.length 
      : 0,
    transactions: categoryTransactions
  };
}

export default {
  CATEGORIES_EXPENSE,
  CATEGORIES_INCOME,
  getCategoryById,
  getSubcategoryLabel,
  getAllCategories,
  getCategoryColor,
  getCategoryIcon,
  getCategoryStats
};
