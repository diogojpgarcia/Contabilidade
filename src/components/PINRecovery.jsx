import React, { useState } from 'react';
import {
  getSecurityQuestion,
  validateSecurityAnswer,
  restoreAutoBackup,
  importData
} from '../utils/security-system';
import { createUserPIN } from '../utils/auth';

const PINRecovery = ({ user, onSuccess, onBack }) => {
  const [method, setMethod] = useState(null); // 'question' or 'code'
  const [answer, setAnswer] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  const securityQuestion = getSecurityQuestion(user.id);

  const handleSecurityAnswer = async (e) => {
    e.preventDefault();
    setError('');

    const isValid = await validateSecurityAnswer(user.id, answer);

    if (isValid) {
      setStep(2); // Go to create new PIN
    } else {
      setError('Resposta incorreta');
    }
  };

  const handleRecoveryCode = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (file) {
        // Restore from file
        await importData(file, recoveryCode);
      } else {
        // Restore from auto backup
        await restoreAutoBackup(user.id, recoveryCode);
      }
      setStep(2); // Go to create new PIN
    } catch (err) {
      setError('Código inválido ou nenhum backup encontrado');
    }
  };

  const handleNewPIN = async (pin) => {
    try {
      await createUserPIN(user.id, pin);
      onSuccess();
    } catch (err) {
      setError('Erro ao criar novo PIN');
    }
  };

  if (!method) {
    return (
      <div className="pin-recovery">
        <div className="recovery-header">
          <h2>🔑 Recuperar PIN</h2>
          <p>Escolhe um método de recuperação</p>
        </div>

        <div className="recovery-methods">
          {securityQuestion && (
            <button
              onClick={() => setMethod('question')}
              className="recovery-method-card"
            >
              <div className="method-icon">❓</div>
              <div className="method-title">Pergunta de Segurança</div>
              <div className="method-desc">
                Responde à tua pergunta secreta
              </div>
            </button>
          )}

          <button
            onClick={() => setMethod('code')}
            className="recovery-method-card"
          >
            <div className="method-icon">🔐</div>
            <div className="method-title">Código de Recuperação</div>
            <div className="method-desc">
              Usa o código que guardaste
            </div>
          </button>
        </div>

        <button onClick={onBack} className="btn-back">
          ← Voltar
        </button>
      </div>
    );
  }

  if (method === 'question' && step === 1) {
    return (
      <div className="pin-recovery">
        <div className="recovery-header">
          <h2>❓ Pergunta de Segurança</h2>
        </div>

        <form onSubmit={handleSecurityAnswer} className="recovery-form">
          <div className="question-display">
            {securityQuestion}
          </div>

          <div className="form-group">
            <label>Tua Resposta</label>
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Introduz a resposta..."
              required
              autoFocus
              autoComplete="off"
            />
          </div>

          {error && <div className="recovery-error">{error}</div>}

          <div className="recovery-actions">
            <button type="button" onClick={() => setMethod(null)} className="btn-secondary">
              ← Voltar
            </button>
            <button type="submit" className="btn-primary">
              Verificar
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (method === 'code' && step === 1) {
    return (
      <div className="pin-recovery">
        <div className="recovery-header">
          <h2>🔐 Código de Recuperação</h2>
        </div>

        <form onSubmit={handleRecoveryCode} className="recovery-form">
          <div className="form-group">
            <label>Código de Recuperação</label>
            <input
              type="text"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
              placeholder="XX-XXXX-XXXX"
              required
              autoFocus
              pattern="[A-Z0-9]{2}-[A-Z0-9]{4}-[A-Z0-9]{4}"
              autoComplete="off"
            />
            <small>Formato: XX-XXXX-XXXX</small>
          </div>

          <div className="form-divider">
            <span>ou</span>
          </div>

          <div className="form-group">
            <label>Importar de Ficheiro de Backup</label>
            <input
              type="file"
              accept=".encrypted,.txt"
              onChange={(e) => setFile(e.target.files[0])}
              className="file-input"
            />
            <small>Escolhe o ficheiro de backup que exportaste</small>
          </div>

          {error && <div className="recovery-error">{error}</div>}

          <div className="recovery-actions">
            <button type="button" onClick={() => setMethod(null)} className="btn-secondary">
              ← Voltar
            </button>
            <button type="submit" className="btn-primary">
              Recuperar Dados
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="pin-recovery">
        <div className="recovery-header success">
          <div className="success-icon">✅</div>
          <h2>Dados Recuperados!</h2>
          <p>Agora cria um novo PIN</p>
        </div>

        <NewPINInput onComplete={handleNewPIN} error={error} />
      </div>
    );
  }
};

// Simple component for new PIN creation
const NewPINInput = ({ onComplete, error }) => {
  const [pinLength, setPinLength] = useState(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [step, setStep] = useState(1);
  const [pinError, setPinError] = useState('');

  const handlePinInput = (index, value, isConfirm = false) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = isConfirm ? [...confirmPin] : [...pin];
    newPin[index] = value.slice(-1);

    if (isConfirm) {
      setConfirmPin(newPin);
      if (index === pinLength - 1 && value) {
        // Check if PINs match
        if (newPin.join('') === pin.join('')) {
          onComplete(newPin.join(''));
        } else {
          setPinError('Os PINs não coincidem');
          setTimeout(() => {
            setConfirmPin(Array(pinLength).fill(''));
            setPinError('');
          }, 1500);
        }
      }
    } else {
      setPin(newPin);
      if (index === pinLength - 1 && value) {
        setStep(2); // Go to confirm
      }
    }
  };

  if (!pinLength) {
    return (
      <div className="new-pin-setup">
        <p>Escolhe o tamanho do novo PIN:</p>
        <div className="pin-length-options">
          <button onClick={() => setPinLength(4)} className="pin-length-btn">
            <div className="pin-length-number">4</div>
            <div>dígitos</div>
          </button>
          <button onClick={() => setPinLength(6)} className="pin-length-btn">
            <div className="pin-length-number">6</div>
            <div>dígitos</div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="new-pin-input">
      <p>{step === 1 ? 'Novo PIN:' : 'Confirma o PIN:'}</p>
      <div className="pin-inputs">
        {(step === 1 ? pin : confirmPin).map((digit, index) => (
          <input
            key={index}
            type="tel"
            inputMode="numeric"
            maxLength="1"
            value={digit}
            onChange={(e) => handlePinInput(index, e.target.value, step === 2)}
            className="pin-digit"
            autoFocus={index === 0}
          />
        ))}
      </div>
      {pinError && <div className="pin-error">{pinError}</div>}
      {error && <div className="recovery-error">{error}</div>}
    </div>
  );
};

export default PINRecovery;
