import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { usePortalContainer } from "../../lib/portal.js";
import { cn } from "../../lib/utils.js";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  const container = usePortalContainer();
  return (
    <DialogPrimitive.Portal container={container}>
      <DialogPrimitive.Overlay className="still:fixed still:inset-0 still:z-[1000] still:bg-black/40 still:data-[state=open]:animate-in still:data-[state=open]:fade-in-0 still:data-[state=closed]:animate-out still:data-[state=closed]:fade-out-0" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "still:fixed still:top-1/2 still:left-1/2 still:z-[1001] still:grid still:max-h-[calc(100dvh-2rem)] still:w-[calc(100%-2rem)] still:max-w-md still:-translate-x-1/2 still:-translate-y-1/2 still:gap-4 still:overflow-y-auto still:rounded-lg still:border still:border-border still:bg-popover still:p-5 still:text-popover-foreground still:shadow-lg still:data-[state=open]:animate-in still:data-[state=open]:fade-in-0 still:data-[state=open]:zoom-in-95 still:data-[state=closed]:animate-out still:data-[state=closed]:fade-out-0 still:data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="still:absolute still:top-4 still:right-4 still:rounded-sm still:text-muted-foreground still:opacity-70 still:transition-opacity still:hover:opacity-100 still:cursor-pointer">
          <XIcon className="still:size-4" />
          <span className="still:sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("still:flex still:flex-col still:gap-1.5 still:pr-6", className)} {...props} />;
}

function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="dialog-footer" className={cn("still:flex still:flex-wrap still:justify-end still:gap-2", className)} {...props} />;
}

function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("still:text-base still:font-semibold still:leading-none", className)} {...props} />;
}

function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn("still:text-sm still:text-muted-foreground", className)} {...props} />;
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger };
