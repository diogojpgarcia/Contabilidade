import { describe, it, expect } from 'vitest';
import { generateLocalAnalysis } from '../src/utils/localInsights.js';

const base = {
  period: 'Junho 2026',
  income: 1000, expenses: 700, savings: 300, savingsRate: 30, expenseTrend: -8,
  topCategories: [{ name: 'Habitação', amount: 500, pct: 71 }],
  budgetDetails: [
    { name: 'Lazer', budget: 100, spent: 80, pct: 80, over: false },
    { name: 'Compras', budget: 50, spent: 40, pct: 80, over: false },
  ],
  categoryTrends: [{ name: 'Habitação', prev2: 500, prev: 500, curr: 500 }],
  fiftyThirtyTwenty: { needs: 500, wants: 200, savings: 300, needsPct: 50, wantsPct: 20, savingsPct: 30 },
  emergencyMonths: 4,
};

describe('generateLocalAnalysis', () => {
  it('devolve null sem resumo', () => {
    expect(generateLocalAnalysis(null)).toBeNull();
  });

  it('personaliza com o perfil: meta e objetivo do utilizador', () => {
    // savingsRate 30 vs meta de 35 (acima) → ainda abaixo da meta; objetivo lidera.
    const lowSave = { ...base, income: 1000, expenses: 700, savings: 300, savingsRate: 30 };
    const a = generateLocalAnalysis(lowSave, { goal: 'savings', savingsTarget: 35, variableIncome: false, configured: true });
    expect(a.detailedAnalysis).toContain('meta de 35%');
    expect(a.recommendations[0]).toContain('Objetivo "poupar mais"');

    // objetivo fundo de emergência → recomendação lidera com o tema
    const b = generateLocalAnalysis({ ...base, emergencyMonths: 2 }, { goal: 'emergency', savingsTarget: 20, variableIncome: true, configured: true });
    expect(b.recommendations[0].toLowerCase()).toContain('fundo de emergência');
    // rendimento variável → alvo de 6 meses
    expect(b.concerns.some(c => c.includes('6 meses'))).toBe(true);
  });

  it('cenário saudável: pontos fortes, projeção e perspetiva', () => {
    const a = generateLocalAnalysis(base);
    expect(a.summary).toContain('30%');
    expect(a.strengths.some(s => s.includes('30%'))).toBe(true);          // taxa de poupança
    expect(a.strengths.some(s => s.includes('4 meses'))).toBe(true);       // fundo de emergência
    expect(a.projections).toContain('12 meses');
    expect(Array.isArray(a.categoryInsights)).toBe(true);
    expect(a.detailedAnalysis).toContain('50/30/20');
  });

  it('cenário de défice: resumo, preocupação e projeção negativa', () => {
    const a = generateLocalAnalysis({
      ...base, income: 800, expenses: 1000, savings: -200, savingsRate: -25,
      fiftyThirtyTwenty: { needs: 600, wants: 400, savings: -200, needsPct: 75, wantsPct: 50, savingsPct: -25 },
      emergencyMonths: 1,
    });
    expect(a.summary).toContain('200€');
    expect(a.summary).toContain('a mais');
    expect(a.concerns.some(c => c.toLowerCase().includes('défice'))).toBe(true);
    expect(a.projections).toContain('além do que recebes');
    expect(a.outlook).toContain('saldo positivo');
  });

  it('orçamento excedido vira preocupação e recomendação', () => {
    const a = generateLocalAnalysis({
      ...base,
      budgetDetails: [{ name: 'Restaurantes', budget: 100, spent: 150, pct: 150, over: true }],
    });
    expect(a.concerns.some(c => c.includes('Restaurantes') && c.includes('excedido'))).toBe(true);
    expect(a.recommendations.some(r => r.includes('Restaurantes'))).toBe(true);
  });
});
