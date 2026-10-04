import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils.js";

const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("still:inline-flex still:h-9 still:items-center still:gap-1 still:rounded-lg still:bg-muted still:p-1 still:text-muted-foreground", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "still:inline-flex still:h-full still:items-center still:justify-center still:gap-1.5 still:rounded-md still:px-3 still:text-sm still:font-medium still:whitespace-nowrap still:transition-all still:cursor-pointer still:outline-none still:focus-visible:ring-2 still:focus-visible:ring-ring/50 still:hover:text-foreground still:data-[state=active]:bg-background still:data-[state=active]:text-foreground still:data-[state=active]:shadow-sm still:[&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("still:outline-none still:animate-in still:fade-in-0", className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
