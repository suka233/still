import { Label as LabelPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";

function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("still:flex still:items-center still:gap-2 still:text-xs still:font-medium still:text-muted-foreground still:select-none", className)}
      {...props}
    />
  );
}

export { Label };
