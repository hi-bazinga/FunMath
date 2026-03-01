interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  maxDigits: number;
  allowNegative: boolean;
}

export default function NumberPad({
  value,
  onChange,
  onSubmit,
  maxDigits,
  allowNegative,
}: Props) {
  function press(digit: string) {
    if (digit === '-') {
      onChange(value.startsWith('-') ? value.slice(1) : '-' + value);
      return;
    }
    const raw = value === '0' ? digit : value + digit;
    const digits = raw.replace('-', '');
    if (digits.length <= maxDigits) onChange(raw);
  }

  function backspace() {
    onChange(value.length <= 1 ? '0' : value.slice(0, -1));
  }

  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];

  return (
    <div className="numpad">
      <div className="numpad-display">{value}</div>
      <div className="numpad-grid">
        {keys.map((k) => (
          <button key={k} className="num-btn" onClick={() => press(k)}>
            {k}
          </button>
        ))}

        {allowNegative ? (
          <button className="num-btn sym-btn" onClick={() => press('-')}>
            +/−
          </button>
        ) : (
          <div className="num-btn-spacer" />
        )}

        <button className="num-btn" onClick={() => press('0')}>
          0
        </button>

        <button className="num-btn back-btn" onClick={backspace}>
          ⌫
        </button>
      </div>

      <button className="check-btn" onClick={onSubmit}>
        确认 ✓
      </button>
    </div>
  );
}
