import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useStore } from "zustand";
import type { StillHost } from "./client.js";
import { createTranslate, resolveMessages, type Translate } from "./i18n/index.js";
import { PortalContainerProvider } from "./lib/portal.js";
import type { StillActions, StillState, StillStore } from "./store.js";

interface StillContextValue {
  store: StillStore;
  host: StillHost;
  locale: string;
  t: Translate;
}

const StillContext = createContext<StillContextValue | null>(null);

export interface StillProviderProps {
  store: StillStore;
  host: StillHost;
  /** Host language, e.g. `zh_CN` or `en-US`. */
  lang?: string;
  /** Element carrying the `still-root` class where dialogs are portaled. */
  portalContainer: HTMLElement | null;
  children: ReactNode;
}

export function StillProvider({ store, host, lang, portalContainer, children }: StillProviderProps) {
  const value = useMemo(() => {
    const { locale, messages } = resolveMessages(lang);
    return { store, host, locale, t: createTranslate(messages) };
  }, [store, host, lang]);
  return (
    <StillContext.Provider value={value}>
      <PortalContainerProvider container={portalContainer}>{children}</PortalContainerProvider>
    </StillContext.Provider>
  );
}

function useStillContext(): StillContextValue {
  const ctx = useContext(StillContext);
  if (!ctx) throw new Error("Still components must be rendered inside <StillProvider>");
  return ctx;
}

export function useStill<T>(selector: (state: StillState & StillActions) => T): T {
  return useStore(useStillContext().store, selector);
}

export function useI18n() {
  const { t, locale } = useStillContext();
  return { t, locale };
}

export function useHost(): StillHost {
  return useStillContext().host;
}
