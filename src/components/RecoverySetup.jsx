import React, { useState } from 'react';
import { 
  setupRecovery, 
  SECURITY_QUESTIONS 
} from '../utils/security-system';

const RecoverySetup = ({ user, onComplete, onSkip }) => {
  const [step, setStep] = useState(1);
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [confirmAnswer, setConfirmAnswer] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState('');

  const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedQuestion) {
      setError('Seleciona uma pergunta de segurança');
      return;
    }

    if (answer.trim().length < 2) {
      setError('A resposta deve ter pelo menos 2 caracteres');
      return;
    }

    if (answer.toLowerCase() !== confirmAnswer.toLowerCase()) {
      setError('As respostas não coincidem');
      return;
    }

    try {
      const code = await setupRecovery(user.id, selectedQuestion, answer);
      setRecoveryCode(code);
      setStep(2);
    } catch (err) {
      setError('Erro ao configurar recuperação');
    }
  };

  const handleComplete = () => {
    onComplete(recoveryCode);
  };

  if (step === 1) {
    return (
      <div className="recovery-setup">
        <div className="setup-header">
          <h2>🔐 Configuração de Segurança</h2>
          <p>Protege a tua conta com recuperação de PIN</p>
        </div>

        <form onSubmit={handleQuestionSubmit} className="setup-form">
          <div className="form-group">
            <label>Pergunta de Segurança *</label>
            <select
              value={selectedQuestion}
              onChange={(e) => setSelectedQuestion(e.target.value)}
              required
            >
              <option value="">Escolhe uma pergunta...</option>
              {SECURITY_QUESTIONS.map((q, i) => (
                <option key={i} value={q}>{q}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Resposta *</label>
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="A tua resposta..."
              required
              autoComplete="off"
            />
            <small>Lembra-te desta resposta! Vais precisar para recuperar o PIN.</small>
          </div>

          <div className="form-group">
            <label>Confirma a Resposta *</label>
            <input
              type="text"
              value={confirmAnswer}
              onChange={(e) => setConfirmAnswer(e.target.value)}
              placeholder="Repete a resposta..."
              required
              autoComplete="off"
            />
          </div>

          {error && <div className="setup-error">{error}</div>}

          <div className="setup-actions">
            {onSkip && (
              <button type="button" onClick={onSkip} className="btn-skip">
                Saltar (não recomendado)
              </button>
            )}
            <button type="submit" className="btn-setup-primary">
              Continuar →
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="recovery-setup">
        <div className="setup-header success">
          <div className="success-icon">✅</div>
          <h2>Código de Recuperação</h2>
          <p>Guarda este código num local seguro!</p>
        </div>

        <div className="recovery-code-display">
          <div className="code-box">
            <div className="code-label">Teu Código de Recuperação</div>
            <div className="recovery-code">{recoveryCode}</div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(recoveryCode);
                alert('Código copiado!');
              }}
              className="btn-copy"
            >
              📋 Copiar Código
            </button>
          </div>

          <div className="code-warning">
            <div className="warning-icon">⚠️</div>
            <div className="warning-text">
              <strong>IMPORTANTE:</strong>
              <ul>
                <li>Guarda este código num local seguro (papel, password manager)</li>
                <li>Vais precisar dele se perderes o PIN e esqueceres a resposta</li>
                <li>Sem este código, não há forma de recuperar os dados</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="setup-checklist">
          <label className="checklist-item">
            <input type="checkbox" required />
            <span>Guardei o código num local seguro</span>
          </label>
          <label className="checklist-item">
            <input type="checkbox" required />
            <span>Compreendo que sem ele não posso recuperar os dados</span>
          </label>
        </div>

        <div className="setup-actions">
          <button onClick={handleComplete} className="btn-setup-primary">
            Concluir Configuração ✓
          </button>
        </div>
      </div>
    );
  }
};

export default RecoverySetup;
