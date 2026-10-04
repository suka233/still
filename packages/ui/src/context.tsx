import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useStore } from "zustand";
import type { StillClient, StillHost } from "./client.js";
import { createTranslate, resolveMessages, type MessageKey, type Translate } from "./i18n/index.js";
import { PortalContainerProvider } from "./lib/portal.js";
import type { StillActions, StillState, StillStore } from "./store.js";

interface StillContextValue {
  store: StillStore;
  client: StillClient;
  host: StillHost;
  locale: string;
  t: Translate;
  hostName: string;
  scopeClassName: string;
  version: string;
}

const StillContext = createContext<StillContextValue | null>(null);

export interface StillProviderProps {
  store: StillStore;
  client: StillClient;
  host: StillHost;
  /** Host language, e.g. `zh_CN` or `en-US`. */
  lang?: string;
  /** Element carrying the `still-root` class where dialogs are portaled. */
  portalContainer: HTMLElement | null;
  /** Shown in "Follow …" labels, e.g. "SiYuan" / "思源". */
  hostName?: string;
  /** Extra classes every Still scope carries in this host (theme mapping hooks). */
  scopeClassName?: string;
  version?: string;
  children: ReactNode;
}

export function StillProvider({
  store,
  client,
  host,
  lang,
  portalContainer,
  hostName = "",
  scopeClassName = "",
  version = "",
  children,
}: StillProviderProps) {
  const value = useMemo(() => {
    const { locale, messages } = resolveMessages(lang);
    const base = createTranslate(messages);
    // Every string may reference {host}; fill it in once here.
    const t: Translate = (key: MessageKey, vars) => base(key, { host: hostName, ...vars });
    return { store, client, host, locale, t, hostName, scopeClassName, version };
  }, [store, client, host, lang, hostName, scopeClassName, version]);
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

export function useClient(): StillClient {
  return useStillContext().client;
}

export function useHostInfo() {
  const { hostName, scopeClassName, version, store } = useStillContext();
  const hostDark = useStore(store, (s) => s.hostDark);
  return { hostName, scopeClassName, hostDark, version };
}
