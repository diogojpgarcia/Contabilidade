import React, { useState, useRef, useEffect } from 'react';

const PINInput = ({ length = 4, onComplete, onBack, error }) => {
  const [step, setStep] = useState(1);
  const [firstPIN, setFirstPIN] = useState('');
  const [digits, setDigits] = useState(Array(length).fill(''));
  const [confirmError, setConfirmError] = useState('');
  const inputRefs = useRef([]);

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  useEffect(() => {
    if (error) {
      setDigits(Array(length).fill(''));
      setStep(1);
      setFirstPIN('');
      setConfirmError('');
    }
  }, [error, length]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);

    // Auto-focus next
    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if complete
    if (value && index === length - 1) {
      const pin = newDigits.join('');
      if (pin.length === length && !pin.includes('')) {
        setTimeout(() => {
          if (step === 1) {
            // First PIN - go to confirmation
            setFirstPIN(pin);
            setDigits(Array(length).fill(''));
            setStep(2);
            setConfirmError('');
          } else {
            // Confirmation
            if (pin === firstPIN) {
              onComplete(pin);
            } else {
              setConfirmError('PINs diferentes. Tenta de novo.');
              setDigits(Array(length).fill(''));
              setStep(1);
              setFirstPIN('');
            }
          }
        }, 150);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  return (
    <div className="pin-input-container">
      <div className="pin-step-indicator">
        <div className={`step ${step === 1 ? 'active' : 'done'}`}>
          {step === 1 ? '1' : '✓'}
        </div>
        <div className="step-line"></div>
        <div className={`step ${step === 2 ? 'active' : ''}`}>2</div>
      </div>
      
      <div className="pin-label">
        {step === 1 ? `Cria PIN (${length} dígitos)` : 'Confirma PIN'}
      </div>

      <div className="pin-inputs">
        {digits.map((digit, index) => (
          <input
            key={`${step}-${index}`}
            ref={el => inputRefs.current[index] = el}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength="1"
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            className={`pin-digit ${error || confirmError ? 'error' : ''}`}
            autoComplete="off"
          />
        ))}
      </div>
      
      {(error || confirmError) && (
        <div className="pin-error">{error || confirmError}</div>
      )}
      
      {onBack && (
        <button onClick={onBack} className="btn-back">
          ← Voltar
        </button>
      )}
    </div>
  );
};

export default PINInput;
