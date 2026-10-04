import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";

export const fieldClassName =
  "still:h-8 still:w-full still:min-w-0 still:rounded-md still:border still:border-input still:bg-transparent still:px-2.5 still:text-sm still:text-foreground still:outline-none still:transition-colors still:placeholder:text-muted-foreground still:focus-visible:border-ring still:focus-visible:ring-2 still:focus-visible:ring-ring/40 still:disabled:cursor-not-allowed still:disabled:opacity-50 still:aria-invalid:border-destructive";

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldClassName, className)} {...props} />;
}

export { Input };
