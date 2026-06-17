/**
 * FinancialProfileSheet — questionário que "ensina" à análise o que o utilizador
 * pretende: objetivo principal, meta de poupança e estabilidade do rendimento.
 * O perfil é guardado nas settings e usado por generateLocalAnalysis.
 */
import React, { useState } from 'react';
import Overlay from '../Overlay';
import { GOAL_OPTIONS, SAVINGS_TARGETS, DEFAULT_PROFILE, normalizeProfile } from '../../utils/financialProfile';
import './FinancialProfileSheet.css';

const FinancialProfileSheet = ({ profile, onSave, onClose }) => {
  const init = normalizeProfile(profile || DEFAULT_PROFILE);
  const [goal, setGoal] = useState(init.goal);
  const [savingsTarget, setSavingsTarget] = useState(init.savingsTarget);
  const [variableIncome, setVariableIncome] = useState(init.variableIncome);

  const save = () => {
    onSave({ goal, savingsTarget, variableIncome, configured: true });
    onClose();
  };

  return (
    <Overlay onClose={onClose} label="Personalizar análise">
      <div className="fps-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fps-handle" />
        <div className="fps-scroll">
          <p className="fps-title">Personaliza a tua análise</p>
          <p className="fps-subtitle">Diz-nos o que procuras e a análise adapta-se aos teus objetivos.</p>

          {/* 1. Objetivo principal */}
          <div className="fps-q">
            <div className="fps-q-label">Qual é o teu objetivo principal?</div>
            <div className="fps-goals">
              {GOAL_OPTIONS.map(g => (
                <button
                  key={g.id}
                  type="button"
                  className={`fps-goal ${goal === g.id ? 'fps-goal--on' : ''}`}
                  onClick={() => setGoal(g.id)}
                >
                  <span className="fps-goal-icon">{g.icon}</span>
                  <span className="fps-goal-text">
                    <span className="fps-goal-label">{g.label}</span>
                    <span className="fps-goal-desc">{g.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Meta de poupança */}
          <div className="fps-q">
            <div className="fps-q-label">Que taxa de poupança queres atingir?</div>
            <div className="fps-chips">
              {SAVINGS_TARGETS.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`fps-chip ${savingsTarget === t ? 'fps-chip--on' : ''}`}
                  onClick={() => setSavingsTarget(t)}
                >
                  {t}%
                </button>
              ))}
            </div>
          </div>

          {/* 3. Estabilidade do rendimento */}
          <div className="fps-q">
            <div className="fps-q-label">Como é o teu rendimento?</div>
            <div className="fps-chips">
              <button
                type="button"
                className={`fps-chip ${!variableIncome ? 'fps-chip--on' : ''}`}
                onClick={() => setVariableIncome(false)}
              >
                Estável
              </button>
              <button
                type="button"
                className={`fps-chip ${variableIncome ? 'fps-chip--on' : ''}`}
                onClick={() => setVariableIncome(true)}
              >
                Variável
              </button>
            </div>
            <p className="fps-hint">
              {variableIncome
                ? 'Com rendimento variável, a meta do fundo de emergência sobe para 6 meses.'
                : 'Fundo de emergência recomendado: 3 a 6 meses de despesas.'}
            </p>
          </div>
        </div>

        <div className="fps-actions">
          <button className="fps-btn fps-btn-cancel" onClick={onClose}>Cancelar</button>
          <button className="fps-btn fps-btn-save" onClick={save}>Guardar</button>
        </div>
      </div>
    </Overlay>
  );
};

export default FinancialProfileSheet;
