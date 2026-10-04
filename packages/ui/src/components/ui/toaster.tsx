import { Toaster as Sonner, toast } from "sonner";

/**
 * Toasts styled with Still tokens. Render once, inside a `.still-root`
 * container (the host's portal) so the tokens apply.
 */
function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      gap={8}
      offset={{ bottom: 40, right: 16 }}
      mobileOffset={{ bottom: 56 }}
      visibleToasts={4}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "still:pointer-events-auto still:flex still:w-[min(360px,calc(100vw-32px))] still:items-start still:gap-3 still:rounded-lg still:border still:border-border still:bg-popover still:px-4 still:py-3 still:text-sm still:text-popover-foreground still:shadow-lg",
          title: "still:font-medium",
          description: "still:mt-0.5 still:text-xs still:text-muted-foreground",
          content: "still:flex still:min-w-0 still:flex-1 still:flex-col",
          icon: "still:mt-0.5 still:shrink-0",
          actionButton:
            "still:shrink-0 still:self-center still:rounded-md still:bg-primary still:px-2.5 still:py-1 still:text-xs still:font-medium still:text-primary-foreground still:cursor-pointer still:hover:bg-primary/90",
          cancelButton:
            "still:shrink-0 still:self-center still:rounded-md still:px-2.5 still:py-1 still:text-xs still:font-medium still:text-muted-foreground still:cursor-pointer still:hover:bg-accent",
          error: "still:border-destructive/40",
        },
      }}
    />
  );
}

export { Toaster, toast };
