import { Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";

function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "still:peer still:inline-flex still:h-5 still:w-9 still:shrink-0 still:cursor-pointer still:items-center still:rounded-full still:border still:border-transparent still:transition-colors still:outline-none still:focus-visible:ring-2 still:focus-visible:ring-ring/50 still:disabled:cursor-not-allowed still:disabled:opacity-50 still:data-[state=checked]:bg-primary still:data-[state=unchecked]:bg-input",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="still:pointer-events-none still:block still:size-4 still:rounded-full still:bg-background still:shadow-sm still:ring-0 still:transition-transform still:data-[state=checked]:translate-x-4 still:data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
