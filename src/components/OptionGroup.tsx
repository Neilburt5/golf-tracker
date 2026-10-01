interface Option<T extends string> {
  value: T;
  label: string;
}

interface OptionGroupProps<T extends string> {
  legend: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function OptionGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
}: OptionGroupProps<T>) {
  return (
    <fieldset className="field">
      <legend>{legend}</legend>
      <div className="options">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="option"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}