interface TerminalDisplayProps {
  amount: string;
  label?: string;
  isActive?: boolean;
  tokenSymbol?: string;
}

export function TerminalDisplay({
  amount,
  label = "AMOUNT",
  isActive = true,
  tokenSymbol = "TOKEN",
}: TerminalDisplayProps) {
  const formattedAmount = amount ? parseFloat(amount).toFixed(2) : "0.00";

  return (
    <div className="terminal-display-container">
      <div className="terminal-display-label">{label}</div>
      <div className={`terminal-display-amount ${isActive ? "terminal-display-active" : ""}`}>
        <span className="terminal-display-currency">$</span>
        <span className="terminal-display-digits">{formattedAmount}</span>
      </div>
      <div className="terminal-display-token">{tokenSymbol}</div>
    </div>
  );
}
