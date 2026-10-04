import type { Subscription } from "@still/core";
import { cn } from "../lib/utils.js";

const HUES = [210, 340, 160, 30, 270, 190, 0, 120];

function hueOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return HUES[Math.abs(h) % HUES.length]!;
}

export function SubscriptionAvatar({ subscription, className }: { subscription: Subscription; className?: string }) {
  const { icon, name } = subscription;
  const isImage = Boolean(icon && /^(https?:|data:image\/)/.test(icon));
  return (
    <span
      aria-hidden
      className={cn("still:flex still:size-8 still:shrink-0 still:items-center still:justify-center still:overflow-hidden still:rounded-md still:text-sm still:font-semibold", className)}
      style={icon ? undefined : { backgroundColor: `hsl(${hueOf(name)} 70% 50% / 0.16)`, color: `hsl(${hueOf(name)} 60% 42%)` }}
    >
      {isImage ? <img src={icon!} alt="" className="still:size-full still:object-cover" /> : icon || [...name][0]?.toUpperCase()}
    </span>
  );
}
