import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";

const badgeVariants = cva(
  "still:inline-flex still:items-center still:gap-1 still:rounded-md still:border still:px-1.5 still:py-0.5 still:text-xs still:font-medium still:whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "still:border-transparent still:bg-primary still:text-primary-foreground",
        secondary: "still:border-transparent still:bg-secondary still:text-secondary-foreground",
        destructive: "still:border-transparent still:bg-destructive still:text-white",
        warning: "still:border-transparent still:bg-warning still:text-warning-foreground",
        outline: "still:border-border still:text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
