import { PencilLineIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { categoryLabel } from "../catalog/category.js";
import { SERVICE_ICON_PREFIX, displayName, searchServices, type CatalogService } from "../catalog/services.js";
import { useI18n } from "../context.js";
import { cn } from "../lib/utils.js";
import { SubscriptionAvatar } from "./SubscriptionAvatar.js";

export type PickResult = { kind: "service"; service: CatalogService } | { kind: "custom"; name: string };

/** Step one of adding: search the catalog, or fall through to a custom entry. */
export function ServicePicker({ onPick }: { onPick(result: PickResult): void }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => searchServices(query, locale), [query, locale]);
  const trimmed = query.trim();
  // The custom entry comes first when typing, so Enter on an unknown name just works.
  const items: PickResult[] = [
    ...(trimmed ? [{ kind: "custom" as const, name: trimmed }] : []),
    ...results.map((service) => ({ kind: "service" as const, service })),
  ];
  const firstServiceIndex = trimmed ? 1 : 0;

  useEffect(() => setActive(trimmed && results.length ? 1 : 0), [query, results.length, trimmed]);
  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function onKeyDown(e: KeyboardEvent) {
    const columns = 3;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i < firstServiceIndex ? firstServiceIndex : i + columns));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - columns < firstServiceIndex ? (trimmed ? 0 : firstServiceIndex) : i - columns));
    } else if (e.key === "ArrowRight") {
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowLeft") {
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[active];
      if (item) onPick(item);
      else onPick({ kind: "custom", name: trimmed });
    }
  }

  return (
    <div className="still:grid still:gap-3">
      <div className="still:relative">
        <SearchIcon className="still:pointer-events-none still:absolute still:top-1/2 still:left-3 still:size-4 still:-translate-y-1/2 still:text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("picker.search")}
          aria-label={t("picker.search")}
          className="still:h-10 still:w-full still:rounded-lg still:border still:border-input still:bg-transparent still:pr-3 still:pl-9 still:text-sm still:outline-none still:placeholder:text-muted-foreground still:focus-visible:border-ring still:focus-visible:ring-2 still:focus-visible:ring-ring/30"
        />
      </div>

      <div ref={listRef} className="still:-mx-1 still:max-h-[min(52vh,420px)] still:overflow-y-auto still:px-1 still:pb-1">
        {trimmed && (
          <button
            type="button"
            data-index={0}
            onMouseEnter={() => setActive(0)}
            onClick={() => onPick({ kind: "custom", name: trimmed })}
            className={cn(
              "still:mb-2 still:flex still:w-full still:items-center still:gap-2.5 still:rounded-lg still:border still:border-dashed still:border-border still:px-3 still:py-2 still:text-left still:text-sm",
              active === 0 && "still:border-primary still:bg-accent",
            )}
          >
            <PencilLineIcon className="still:size-4 still:text-muted-foreground" />
            <span className="still:truncate">{t("picker.custom", { name: trimmed })}</span>
          </button>
        )}

        <div className="still:mb-1.5 still:text-xs still:font-medium still:text-muted-foreground">
          {trimmed ? t("picker.results") : t("picker.popular")}
        </div>
        {results.length === 0 ? (
          <p className="still:py-4 still:text-center still:text-sm still:text-muted-foreground">{t("picker.noResults")}</p>
        ) : (
          <div className="still:grid still:grid-cols-3 still:gap-1.5">
            {results.map((service, i) => {
              const index = i + firstServiceIndex;
              return (
                <button
                  key={service.id}
                  type="button"
                  data-index={index}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => onPick({ kind: "service", service })}
                  title={categoryLabel(service.category, t)}
                  className={cn(
                    "still:flex still:min-w-0 still:flex-col still:items-center still:gap-1.5 still:rounded-lg still:border still:border-transparent still:px-1 still:py-2.5 still:text-center still:transition-colors",
                    active === index ? "still:border-border still:bg-accent" : "still:hover:bg-accent",
                  )}
                >
                  <SubscriptionAvatar subscription={{ icon: SERVICE_ICON_PREFIX + service.id, name: service.name }} className="still:size-9" />
                  <span className="still:w-full still:truncate still:text-xs still:font-medium">{displayName(service, locale)}</span>
                </button>
              );
            })}
          </div>
        )}

        {!trimmed && (
          <button
            type="button"
            onClick={() => onPick({ kind: "custom", name: "" })}
            className="still:mt-2 still:flex still:w-full still:items-center still:gap-2.5 still:rounded-lg still:border still:border-dashed still:border-border still:px-3 still:py-2 still:text-left still:text-sm still:hover:bg-accent"
          >
            <PlusIcon className="still:size-4 still:text-muted-foreground" />
            <span className="still:flex still:flex-col">
              <span>{t("picker.blank")}</span>
              <span className="still:text-xs still:text-muted-foreground">{t("picker.blankHint")}</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
