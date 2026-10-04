import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";
import { fieldClassName } from "./input.js";

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldClassName, "still:h-auto still:min-h-16 still:py-1.5", className)} {...props} />;
}

export { Textarea };
