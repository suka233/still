import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";

const badgeVariants = cva(
  "still:inline-flex still:items-center still:gap-1 still:rounded-md still:border still:px-1.5 still:py-px still:text-[11px] still:font-medium still:leading-4 still:whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "still:border-transparent still:bg-primary still:text-primary-foreground",
        secondary: "still:border-transparent still:bg-secondary still:text-secondary-foreground",
        destructive: "still:border-transparent still:bg-destructive still:text-white",
        warning: "still:border-transparent still:bg-warning still:text-warning-foreground",
        outline: "still:border-border still:text-foreground",
        soft: "still:border-transparent still:bg-foreground/[0.06] still:text-muted-foreground",
        "soft-warning": "still:border-transparent still:bg-warning/60 still:text-warning-foreground",
        "soft-primary": "still:border-transparent still:bg-primary/12 still:text-primary",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
