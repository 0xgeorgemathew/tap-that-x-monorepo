import { Info } from "lucide-react";

export const InheritanceTooltip = ({ inheritedFrom }: { inheritedFrom?: string }) => (
  <>
    {inheritedFrom && (
      <span
        className="tooltip tooltip-top tooltip-accent px-2 md:break-words"
        data-tip={`Inherited from: ${inheritedFrom}`}
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </span>
    )}
  </>
);
