import * as React from "react";
import { type VariantProps, cva } from "class-variance-authority";
import { cn } from "~~/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-content",
        secondary: "border-transparent bg-secondary text-secondary-content",
        success: "border-transparent bg-success text-white",
        error: "border-transparent bg-error text-white",
        outline: "text-base-content border-base-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
