import type { Subscription } from "@still/core";
import { BRAND_ICON_PATHS } from "../catalog/icons.generated.js";
import { getService, serviceIdOfIcon } from "../catalog/services.js";
import { readableOn } from "../theme.js";
import { cn } from "../lib/utils.js";

const HUES = [210, 340, 160, 30, 270, 190, 0, 120];

function hueOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return HUES[Math.abs(h) % HUES.length]!;
}

function monogram(name: string): string {
  const latin = name.match(/[A-Za-z0-9]/);
  return (latin ? latin[0] : [...name.trim()][0] ?? "?").toUpperCase();
}

/**
 * A subscription's icon: a catalog brand (logo on its brand colour, or a
 * monogram when the logo isn't in the set), an emoji, an image URL, or a
 * name-tinted monogram.
 */
export function SubscriptionAvatar({ subscription, className }: { subscription: Pick<Subscription, "icon" | "name">; className?: string }) {
  const { icon, name } = subscription;
  const base =
    "still-avatar still:flex still:size-8 still:shrink-0 still:items-center still:justify-center still:overflow-hidden still:text-sm still:font-semibold still:select-none";

  const service = getService(serviceIdOfIcon(icon));
  if (service) {
    const path = service.icon ? BRAND_ICON_PATHS[service.icon] : undefined;
    const fg = readableOn(service.color);
    return (
      <span aria-hidden className={cn(base, className)} style={{ backgroundColor: service.color, color: fg }}>
        {path ? (
          <svg viewBox="0 0 24 24" className="still:size-[58%]" fill="currentColor" aria-hidden>
            <path d={path} />
          </svg>
        ) : (
          <span className="still:text-[0.95em] still:font-bold">{monogram(service.name)}</span>
        )}
      </span>
    );
  }

  if (icon && /^(https?:|data:image\/)/.test(icon)) {
    return (
      <span aria-hidden className={cn(base, "still:bg-muted", className)}>
        <img src={icon} alt="" className="still:size-full still:object-cover" />
      </span>
    );
  }

  if (icon) {
    return (
      <span aria-hidden className={cn(base, "still:bg-muted still:text-[1.15em]", className)}>
        {icon}
      </span>
    );
  }

  const hue = hueOf(name);
  return (
    <span
      aria-hidden
      className={cn(base, className)}
      style={{
        // Mixing with the foreground keeps contrast in light and dark themes.
        backgroundColor: `hsl(${hue} 70% 50% / 0.16)`,
        color: `color-mix(in oklab, hsl(${hue} 65% 45%) 65%, var(--foreground))`,
      }}
    >
      {monogram(name)}
    </span>
  );
}
