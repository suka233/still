import { StillProvider, applyAppearance, resolveAppearance, type StillClient, type StillHost, type StillStore } from "@still/ui";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

/** Classes every Still scope carries in SiYuan; `still-siyuan` hooks the theme mapping. */
export const SCOPE_CLASS = "still-siyuan";

export interface MountContext {
  store: StillStore;
  client: StillClient;
  host: StillHost;
  lang: string;
  hostName: string;
  version: string;
  portalContainer: HTMLElement;
  scopes: ScopeRegistry;
}

/**
 * Tracks every `.still-root` element Still created so appearance changes
 * (theme, accent, SiYuan's light/dark switch) reach all of them at once.
 */
export class ScopeRegistry {
  readonly #scopes = new Set<HTMLElement>();
  readonly #store: StillStore;
  readonly #unsubscribe: () => void;

  constructor(store: StillStore) {
    this.#store = store;
    let last = "";
    this.#unsubscribe = store.subscribe((s) => {
      const key = JSON.stringify([s.settings.appearance, s.hostDark]);
      if (key !== last) {
        last = key;
        this.applyAll();
      }
    });
  }

  add(el: HTMLElement) {
    this.#scopes.add(el);
    this.#apply(el);
  }

  delete(el: HTMLElement) {
    this.#scopes.delete(el);
  }

  applyAll() {
    for (const el of this.#scopes) this.#apply(el);
  }

  dispose() {
    this.#unsubscribe();
    this.#scopes.clear();
  }

  #apply(el: HTMLElement) {
    const { settings, hostDark } = this.#store.getState();
    applyAppearance(el, resolveAppearance(settings.appearance, hostDark));
  }
}

/** Renders a Still view into a host element inside its own `.still-root` scope. */
export function mount(container: Element, node: ReactNode, ctx: MountContext, { fill = true } = {}): () => void {
  const scope = document.createElement("div");
  scope.className = `still-root ${SCOPE_CLASS}`;
  if (fill) scope.style.height = "100%";
  container.append(scope);
  ctx.scopes.add(scope);
  const root: Root = createRoot(scope);
  root.render(
    <StillProvider
      store={ctx.store}
      client={ctx.client}
      host={ctx.host}
      lang={ctx.lang}
      hostName={ctx.hostName}
      scopeClassName={SCOPE_CLASS}
      version={ctx.version}
      portalContainer={ctx.portalContainer}
    >
      {node}
    </StillProvider>,
  );
  return () => {
    root.unmount();
    ctx.scopes.delete(scope);
    scope.remove();
  };
}
