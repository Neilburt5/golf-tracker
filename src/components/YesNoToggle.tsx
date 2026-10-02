interface YesNoToggleProps {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  /** Adds a third "N/A" option that maps to null. */
  allowNotApplicable?: boolean;
}

export function YesNoToggle({
  label,
  value,
  onChange,
  allowNotApplicable = false,
}: YesNoToggleProps) {
  const options: { text: string; value: boolean | null }[] = [
    { text: 'Sí', value: true },
    { text: 'No', value: false },
  ];
  if (allowNotApplicable) options.push({ text: 'N/A', value: null });

  return (
    <fieldset className="field">
      <legend>{label}</legend>
      <div className="toggle-options" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((option) => (
          <button
            key={option.text}
            type="button"
            className="option"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}