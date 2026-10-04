import { Popover as PopoverPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { usePortalContainer } from "../../lib/portal.js";
import { cn } from "../../lib/utils.js";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

function PopoverContent({ className, align = "center", sideOffset = 6, ...props }: ComponentProps<typeof PopoverPrimitive.Content>) {
  const container = usePortalContainer();
  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "still:z-[1002] still:w-56 still:rounded-lg still:border still:border-border still:bg-popover still:p-1 still:text-popover-foreground still:shadow-lg still:outline-none still:data-[state=open]:animate-in still:data-[state=open]:fade-in-0 still:data-[state=open]:zoom-in-95 still:data-[state=closed]:animate-out still:data-[state=closed]:fade-out-0 still:data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
