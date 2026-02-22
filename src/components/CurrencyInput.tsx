import React, { useState, useCallback } from 'react';

interface CurrencyInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  className?: string;
  allowNull?: boolean;
}

const formatWithCommas = (num: number): string => {
  const parts = num.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

const stripFormatting = (str: string): string => {
  return str.replace(/[^0-9.\-]/g, '');
};

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder = '0.00',
  className = '',
  allowNull = false,
}) => {
  const [displayValue, setDisplayValue] = useState<string>(
    value !== null && value !== 0 ? formatWithCommas(value) : ''
  );
  const [isFocused, setIsFocused] = useState(false);

  // Sync display when value changes externally and not focused
  React.useEffect(() => {
    if (!isFocused) {
      setDisplayValue(
        value !== null && value !== 0 ? formatWithCommas(value) : ''
      );
    }
  }, [value, isFocused]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    // Show raw number on focus
    if (value !== null && value !== 0) {
      setDisplayValue(String(value));
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const raw = stripFormatting(displayValue);
    const num = parseFloat(raw);
    if (isNaN(num) || raw === '') {
      if (allowNull) {
        onChange(null);
        setDisplayValue('');
      } else {
        onChange(0);
        setDisplayValue('');
      }
    } else {
      onChange(num);
      setDisplayValue(formatWithCommas(num));
    }
  }, [displayValue, onChange, allowNull]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow only digits, decimal, and minus
    const cleaned = raw.replace(/[^0-9.\-]/g, '');
    setDisplayValue(cleaned);
  }, []);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  );
};
