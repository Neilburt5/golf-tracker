interface StepperProps {
  label: string;
  /** null renders as "–" (not entered yet). */
  value: number | null;
  /** Small text under the label, e.g. "+1". */
  hint?: string;
  canDecrement?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
}

export function Stepper({
  label,
  value,
  hint,
  canDecrement = true,
  onIncrement,
  onDecrement,
}: StepperProps) {
  return (
    <div className="stepper-row">
      <div className="stepper-label">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div className="stepper-controls">
        <button
          type="button"
          className="stepper-btn"
          aria-label={`Restar ${label}`}
          onClick={onDecrement}
          disabled={!canDecrement}
        >
          −
        </button>
        <output className="stepper-value" aria-label={label}>
          {value === null ? '–' : value}
        </output>
        <button
          type="button"
          className="stepper-btn"
          aria-label={`Sumar ${label}`}
          onClick={onIncrement}
        >
          +
        </button>
      </div>
    </div>
  );
}