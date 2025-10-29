import { Loader2, Nfc } from "lucide-react";

interface NfcTapZoneProps {
  isActive: boolean;
  isProcessing?: boolean;
  label: string;
  subLabel?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function NfcTapZone({
  isActive,
  isProcessing = false,
  label,
  subLabel,
  onClick,
  disabled = false,
}: NfcTapZoneProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isProcessing}
      className={`nfc-tap-zone ${isActive ? "nfc-tap-zone-active" : ""} ${isProcessing ? "nfc-tap-zone-processing" : ""}`}
    >
      <div className="nfc-tap-zone-waves">
        <div className="nfc-wave nfc-wave-1"></div>
        <div className="nfc-wave nfc-wave-2"></div>
        <div className="nfc-wave nfc-wave-3"></div>
      </div>

      <div className="nfc-tap-zone-icon">{isProcessing ? <Loader2 className="animate-spin" /> : <Nfc />}</div>

      <div className="nfc-tap-zone-text">
        <div className="nfc-tap-zone-label">{label}</div>
        {subLabel && <div className="nfc-tap-zone-sublabel">{subLabel}</div>}
      </div>

      <div className={`nfc-tap-zone-indicator ${isActive ? "nfc-indicator-active" : ""}`}></div>
    </button>
  );
}
