import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";

const buttonVariants = cva(
  "still:inline-flex still:shrink-0 still:items-center still:justify-center still:gap-1.5 still:whitespace-nowrap still:rounded-lg still:text-sm still:font-medium still:transition-[background-color,color,box-shadow,transform] still:duration-150 still:outline-none still:cursor-pointer still:select-none still:active:scale-[0.97] still:focus-visible:ring-2 still:focus-visible:ring-ring/60 still:focus-visible:ring-offset-1 still:focus-visible:ring-offset-background still:disabled:pointer-events-none still:disabled:opacity-50 still:[&_svg]:pointer-events-none still:[&_svg]:shrink-0 still:[&_svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        default: "still:bg-primary still:text-primary-foreground still:shadow-[0_1px_2px_rgb(0_0_0/0.12),inset_0_1px_0_rgb(255_255_255/0.12)] still:hover:bg-primary/90",
        destructive: "still:bg-destructive still:text-white still:shadow-[0_1px_2px_rgb(0_0_0/0.12)] still:hover:bg-destructive/90",
        "soft-destructive": "still:bg-destructive/10 still:text-destructive still:hover:bg-destructive/15",
        outline: "still:border still:border-border still:bg-background still:hover:bg-accent still:hover:text-accent-foreground",
        secondary: "still:bg-secondary still:text-secondary-foreground still:hover:bg-secondary/80",
        soft: "still:bg-foreground/[0.05] still:text-foreground still:hover:bg-foreground/[0.09]",
        ghost: "still:text-foreground still:hover:bg-foreground/[0.06]",
        link: "still:text-primary still:underline-offset-4 still:hover:underline",
      },
      size: {
        default: "still:h-8 still:px-3",
        sm: "still:h-7 still:rounded-md still:px-2.5 still:text-xs",
        lg: "still:h-10 still:px-4",
        xl: "still:h-11 still:rounded-xl still:px-5 still:text-[15px]",
        icon: "still:size-8",
        "icon-sm": "still:size-7 still:rounded-md",
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
