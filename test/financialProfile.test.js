import { describe, it, expect } from 'vitest';
import { normalizeProfile, goalToFocus, DEFAULT_PROFILE } from '../src/utils/financialProfile.js';

describe('normalizeProfile', () => {
  it('preenche defaults a partir de objeto vazio', () => {
    expect(normalizeProfile({})).toEqual({
      goal: 'savings', savingsTarget: 20, variableIncome: false, monthlyIncome: 0,
      emergencyIncludesAforro: true, configured: false,
    });
  });
  it('respeita o toggle de aforro no fundo de emergência', () => {
    expect(normalizeProfile({ emergencyIncludesAforro: false }).emergencyIncludesAforro).toBe(false);
    expect(normalizeProfile({ emergencyIncludesAforro: true }).emergencyIncludesAforro).toBe(true);
    expect(normalizeProfile({}).emergencyIncludesAforro).toBe(true); // default p/ perfis antigos
  });
  it('valida o objetivo e limita a meta de poupança', () => {
    expect(normalizeProfile({ goal: 'inexistente' }).goal).toBe('savings');
    expect(normalizeProfile({ goal: 'emergency' }).goal).toBe('emergency');
    expect(normalizeProfile({ savingsTarget: 200 }).savingsTarget).toBe(80);
    expect(normalizeProfile({ savingsTarget: 1 }).savingsTarget).toBe(5);
    expect(normalizeProfile({ savingsTarget: 'x' }).savingsTarget).toBe(20);
  });
  it('normaliza o ordenado declarado (âncora)', () => {
    expect(normalizeProfile({ monthlyIncome: 1200 }).monthlyIncome).toBe(1200);
    expect(normalizeProfile({ monthlyIncome: '1500.5' }).monthlyIncome).toBe(1500.5);
    expect(normalizeProfile({ monthlyIncome: -50 }).monthlyIncome).toBe(0);
    expect(normalizeProfile({ monthlyIncome: 'x' }).monthlyIncome).toBe(0);
  });
  it('preserva flags', () => {
    const p = normalizeProfile({ variableIncome: true, configured: true });
    expect(p.variableIncome).toBe(true);
    expect(p.configured).toBe(true);
  });
});

describe('goalToFocus', () => {
  it('mapeia objetivos para focos do motor de regras', () => {
    expect(goalToFocus('emergency')).toBe('savings');
    expect(goalToFocus('debt')).toBe('savings');
    expect(goalToFocus('budgets')).toBe('budgets');
    expect(goalToFocus('tracking')).toBe('tracking');
    expect(goalToFocus('growth')).toBe('growth');
    expect(goalToFocus(undefined)).toBeNull();
  });
});

describe('DEFAULT_PROFILE', () => {
  it('não está marcado como configurado', () => {
    expect(DEFAULT_PROFILE.configured).toBe(false);
  });
});
