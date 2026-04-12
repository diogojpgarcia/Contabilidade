import React, { useState, useRef, useEffect } from 'react';

const PINInput = ({ length = 4, onComplete, onBack, error }) => {
  const [digits, setDigits] = useState(Array(length).fill(''));
  const inputRefs = useRef([]);

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  useEffect(() => {
    // Clear digits when error changes
    if (error) {
      setDigits(Array(length).fill(''));
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    }
  }, [error, length]);

  const handleChange = (index, value) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value.slice(-1); // Only take last digit
    setDigits(newDigits);

    // Auto-focus next input
    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if complete
    if (index === length - 1 && value) {
      const pin = newDigits.join('');
      if (pin.length === length) {
        onComplete(pin);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, length);
    
    if (!/^\d+$/.test(pastedData)) return;

    const newDigits = [...digits];
    for (let i = 0; i < pastedData.length && i < length; i++) {
      newDigits[i] = pastedData[i];
    }
    setDigits(newDigits);

    // Focus last filled input or next empty
    const nextIndex = Math.min(pastedData.length, length - 1);
    inputRefs.current[nextIndex]?.focus();

    // Check if complete
    if (pastedData.length === length) {
      onComplete(pastedData);
    }
  };

  return (
    <div className="pin-input-container">
      <div className="pin-inputs">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={el => inputRefs.current[index] = el}
            type="tel"
            inputMode="numeric"
            maxLength="1"
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className={`pin-digit ${error ? 'error' : ''}`}
            autoComplete="off"
          />
        ))}
      </div>
      {error && <div className="pin-error">{error}</div>}
      {onBack && (
        <button onClick={onBack} className="btn-back">
          ← Voltar
        </button>
      )}
    </div>
  );
};

export default PINInput;
