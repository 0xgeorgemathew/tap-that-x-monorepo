import { Delete } from "lucide-react";

interface NumericKeypadProps {
  onNumberClick: (num: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  disabled?: boolean;
}

export function NumericKeypad({ onNumberClick, onClear, onBackspace, disabled = false }: NumericKeypadProps) {
  const buttons = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    [".", "0", "⌫"],
  ];

  const handleClick = (value: string) => {
    if (disabled) return;

    if (value === "⌫") {
      onBackspace();
    } else if (value === "C") {
      onClear();
    } else {
      onNumberClick(value);
    }
  };

  return (
    <div className="numeric-keypad">
      <div className="numeric-keypad-grid">
        {buttons.map((row, rowIndex) => (
          <div key={rowIndex} className="numeric-keypad-row">
            {row.map(value => (
              <button
                key={value}
                onClick={() => handleClick(value)}
                disabled={disabled}
                className={`numeric-keypad-button ${value === "⌫" ? "numeric-keypad-button-backspace" : ""}`}
              >
                {value === "⌫" ? <Delete className="h-5 w-5" /> : value}
              </button>
            ))}
          </div>
        ))}
      </div>
      <button onClick={onClear} disabled={disabled} className="numeric-keypad-clear">
        CLEAR
      </button>
    </div>
  );
}
