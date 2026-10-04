import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** Tailwind classes are prefixed (`still:`) so they never collide with the host app or other plugins. */
const twMerge = extendTailwindMerge({ prefix: "still" });

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
