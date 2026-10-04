import type { Subscription } from "@still/core";
import { cn } from "../lib/utils.js";

const HUES = [210, 340, 160, 30, 270, 190, 0, 120];

function hueOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return HUES[Math.abs(h) % HUES.length]!;
}

export function SubscriptionAvatar({ subscription, className }: { subscription: Pick<Subscription, "icon" | "name">; className?: string }) {
  const { icon, name } = subscription;
  const isImage = Boolean(icon && /^(https?:|data:image\/)/.test(icon));
  const hue = hueOf(name);
  return (
    <span
      aria-hidden
      className={cn(
        "still-avatar still:flex still:size-8 still:shrink-0 still:items-center still:justify-center still:overflow-hidden still:text-sm still:font-semibold still:select-none",
        className,
      )}
      style={
        icon
          ? undefined
          : {
              // Tinted by name; mixing with the foreground keeps contrast in light and dark themes.
              backgroundColor: `hsl(${hue} 70% 50% / 0.16)`,
              color: `color-mix(in oklab, hsl(${hue} 65% 45%) 65%, var(--foreground))`,
            }
      }
    >
      {isImage ? <img src={icon!} alt="" className="still:size-full still:object-cover" /> : icon || [...name][0]?.toUpperCase()}
    </span>
  );
}
