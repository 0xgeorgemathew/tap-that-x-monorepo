import { Battery, Clock, Wifi } from "lucide-react";

export function TerminalStatusBar() {
  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="terminal-status-bar">
      <div className="terminal-status-item">
        <Clock className="h-3 w-3" />
        <span>{currentTime}</span>
      </div>
      <div className="terminal-status-item">
        <Wifi className="h-3 w-3" />
      </div>
      <div className="terminal-status-item">
        <Battery className="h-3 w-3" />
      </div>
    </div>
  );
}
