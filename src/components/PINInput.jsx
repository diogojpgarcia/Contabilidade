import React, { useState, useRef, useEffect } from 'react';

const PINInput = ({ length = 4, onComplete, onBack, error, masked = true, requireConfirmation = false }) => {
  const [step, setStep] = useState(1); // 1 = create, 2 = confirm
  const [firstPIN, setFirstPIN] = useState('');
  const [digits, setDigits] = useState(Array(length).fill(''));
  const [confirmError, setConfirmError] = useState('');
  const inputRefs = useRef([]);

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  useEffect(() => {
    // Clear digits when error changes
    if (error) {
      setDigits(Array(length).fill(''));
      setStep(1);
      setFirstPIN('');
      setConfirmError('');
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    }
  }, [error, length]);

  const handleChange = (index, value) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);

    // Auto-focus next input
    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if complete
    if (value && index === length - 1) {
      const pin = newDigits.join('');
      if (pin.length === length && !pin.includes('')) {
        // Add small delay for mobile
        setTimeout(() => {
          if (requireConfirmation) {
            if (step === 1) {
              // First PIN entered, go to confirmation
              setFirstPIN(pin);
              setDigits(Array(length).fill(''));
              setStep(2);
              setConfirmError('');
            } else {
              // Confirmation entered, check if matches
              if (pin === firstPIN) {
                onComplete(pin);
              } else {
                setConfirmError('Os PINs não coincidem. Tenta novamente.');
                setDigits(Array(length).fill(''));
                setStep(1);
                setFirstPIN('');
                setTimeout(() => setConfirmError(''), 3000);
              }
            }
          } else {
            // No confirmation needed
            onComplete(pin);
          }
        }, 100);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Move to previous input
        inputRefs.current[index - 1]?.focus();
      } else if (digits[index]) {
        // Clear current
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, length);
    
    if (!/^\d+$/.test(pastedData)) return;

    const newDigits = Array(length).fill('');
    for (let i = 0; i < pastedData.length && i < length; i++) {
      newDigits[i] = pastedData[i];
    }
    setDigits(newDigits);

    const nextIndex = Math.min(pastedData.length, length - 1);
    setTimeout(() => {
      inputRefs.current[nextIndex]?.focus();
      
      if (pastedData.length === length) {
        if (requireConfirmation) {
          if (step === 1) {
            setFirstPIN(pastedData);
            setDigits(Array(length).fill(''));
            setStep(2);
          } else {
            if (pastedData === firstPIN) {
              onComplete(pastedData);
            } else {
              setConfirmError('Os PINs não coincidem.');
              setDigits(Array(length).fill(''));
              setStep(1);
              setFirstPIN('');
            }
          }
        } else {
          onComplete(pastedData);
        }
      }
    }, 50);
  };

  return (
    <div className="pin-input-container">
      {requireConfirmation && (
        <div className="pin-step-indicator">
          <div className={`step ${step === 1 ? 'active' : 'done'}`}>
            {step === 1 ? '1' : '✓'}
          </div>
          <div className="step-line"></div>
          <div className={`step ${step === 2 ? 'active' : ''}`}>2</div>
        </div>
      )}
      
      <div className="pin-label">
        {requireConfirmation 
          ? (step === 1 ? `Cria o teu PIN (${length} dígitos)` : 'Confirma o PIN')
          : 'Introduz o PIN'
        }
      </div>

      <div className="pin-inputs">
        {digits.map((digit, index) => (
          <input
            key={`${step}-${index}`}
            ref={el => inputRefs.current[index] = el}
            type={masked ? "password" : "tel"}
            inputMode="numeric"
            maxLength="1"
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={`pin-digit ${error || confirmError ? 'error' : ''} ${masked ? 'masked' : ''}`}
            autoComplete="off"
            aria-label={`Dígito ${index + 1}`}
          />
        ))}
      </div>
      
      {(error || confirmError) && (
        <div className="pin-error">{error || confirmError}</div>
      )}
      
      {onBack && (
        <button onClick={onBack} className="btn-back" type="button">
          ← Voltar
        </button>
      )}
    </div>
  );
};
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, length);
    
    if (!/^\d+$/.test(pastedData)) return;

    const newDigits = Array(length).fill('');
    for (let i = 0; i < pastedData.length && i < length; i++) {
      newDigits[i] = pastedData[i];
    }
    setDigits(newDigits);

    const nextIndex = Math.min(pastedData.length, length - 1);
    setTimeout(() => {
      inputRefs.current[nextIndex]?.focus();
      
      if (pastedData.length === length) {
        if (requireConfirmation) {
          if (step === 1) {
            setFirstPIN(pastedData);
            setDigits(Array(length).fill(''));
            setStep(2);
          } else {
            if (pastedData === firstPIN) {
              onComplete(pastedData);
            } else {
              setConfirmError('Os PINs não coincidem.');
              setDigits(Array(length).fill(''));
              setStep(1);
              setFirstPIN('');
            }
          }
        } else {
          onComplete(pastedData);
        }
      }
    }, 50);
  };

  return (
    <div className="pin-input-container">
      {requireConfirmation && (
        <div className="pin-step-indicator">
          <div className={`step ${step === 1 ? 'active' : 'done'}`}>
            {step === 1 ? '1' : '✓'}
          </div>
          <div className="step-line"></div>
          <div className={`step ${step === 2 ? 'active' : ''}`}>2</div>
        </div>
      )}
      
      <div className="pin-label">
        {requireConfirmation 
          ? (step === 1 ? `Cria o teu PIN (${length} dígitos)` : 'Confirma o PIN')
          : 'Introduz o PIN'
        }
      </div>

      <div className="pin-inputs">
        {digits.map((digit, index) => (
          <input
            key={`${step}-${index}`}
            ref={el => inputRefs.current[index] = el}
            type={masked ? "password" : "tel"}
            inputMode="numeric"
            maxLength="1"
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={`pin-digit ${error || confirmError ? 'error' : ''} ${masked ? 'masked' : ''}`}
            autoComplete="off"
            aria-label={`Dígito ${index + 1}`}
          />
        ))}
      </div>
      
      {(error || confirmError) && (
        <div className="pin-error">{error || confirmError}</div>
      )}
      
      {onBack && (
        <button onClick={onBack} className="btn-back" type="button">
          ← Voltar
        </button>
      )}
    </div>
  );
};

export default PINInput;
