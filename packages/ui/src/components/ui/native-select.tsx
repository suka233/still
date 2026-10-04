import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";
import { fieldClassName } from "./input.js";

/** A styled native `<select>`: works on every host (incl. mobile) without a portal. */
function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return <select data-slot="native-select" className={cn(fieldClassName, "still:pr-6", className)} {...props} />;
}

export { NativeSelect };
