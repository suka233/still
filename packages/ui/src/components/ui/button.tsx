import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";

const buttonVariants = cva(
  "still:inline-flex still:shrink-0 still:items-center still:justify-center still:gap-1.5 still:whitespace-nowrap still:rounded-md still:text-sm still:font-medium still:transition-colors still:outline-none still:cursor-pointer still:focus-visible:ring-2 still:focus-visible:ring-ring still:disabled:pointer-events-none still:disabled:opacity-50 still:[&_svg]:pointer-events-none still:[&_svg]:shrink-0 still:[&_svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        default: "still:bg-primary still:text-primary-foreground still:hover:bg-primary/90",
        destructive: "still:bg-destructive still:text-white still:hover:bg-destructive/90",
        outline: "still:border still:border-border still:bg-background still:hover:bg-accent still:hover:text-accent-foreground",
        secondary: "still:bg-secondary still:text-secondary-foreground still:hover:bg-secondary/80",
        ghost: "still:hover:bg-accent still:hover:text-accent-foreground",
        link: "still:text-primary still:underline-offset-4 still:hover:underline",
      },
      size: {
        default: "still:h-8 still:px-3",
        sm: "still:h-7 still:px-2.5 still:text-xs",
        lg: "still:h-9 still:px-4",
        icon: "still:size-8",
        "icon-sm": "still:size-7",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
