import { useEffect, useId, useRef, useState } from 'react';
import { parseWorkoutWeight } from './workout-weight';
import './decimal-weight.css';

interface DecimalWeightInputProps {
  value: number | null;
  label: string;
  placeholder: string;
  onChange: (value: number | null, valid: boolean) => void;
  onValidityChange: (valid: boolean) => void;
}

export function DecimalWeightInput({ value, label, placeholder, onChange, onValidityChange }: DecimalWeightInputProps) {
  const [draft, setDraft] = useState(value === null ? '' : String(value));
  const focused = useRef(false);
  const validityCallback = useRef(onValidityChange);
  validityCallback.current = onValidityChange;
  const errorId = useId();
  const parsed = parseWorkoutWeight(draft);

  useEffect(() => {
    if (!focused.current) setDraft(value === null ? '' : String(value));
  }, [value]);

  useEffect(() => {
    validityCallback.current(true);
    return () => validityCallback.current(true);
  }, []);

  return (
    <span className="weight-input-field">
      <input
        className="set-input"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={20}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={!parsed.valid || undefined}
        aria-describedby={!parsed.valid ? errorId : undefined}
        value={draft}
        onFocus={() => { focused.current = true; }}
        onChange={(event) => {
          const raw = event.target.value;
          const next = parseWorkoutWeight(raw);
          setDraft(raw);
          onValidityChange(next.valid);
          onChange(next.value, next.valid);
        }}
        onBlur={() => {
          focused.current = false;
          if (parsed.valid) setDraft(parsed.value === null ? '' : String(parsed.value));
        }}
      />
      {!parsed.valid && <span id={errorId} className="weight-input-error" role="status">Enter 0–2,000 kg using . or ,</span>}
    </span>
  );
}
