import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { StillClient, StillHost } from "./client.js";
import { StillProvider } from "./context.js";
import type { MessageKey } from "./i18n/index.js";
import type { StillStore } from "./store.js";
import { applyAppearance, resolveAppearance } from "./theme.js";

/** Everything a host passes to every Still view it mounts. */
export interface MountContext {
  store: StillStore;
  client: StillClient;
  host: StillHost;
  lang: string;
  hostName: string;
  version: string;
  /** Where dialogs, popovers and toasts portal to (a `.still-root.still-portal`). */
  portalContainer: HTMLElement;
  scopes: ScopeRegistry;
  /** Extra classes on every scope, e.g. a host hook like `still-siyuan`. */
  scopeClassName: string;
  /** Host-specific wording that replaces the shared strings. */
  overrides?: Partial<Record<MessageKey, string>>;
}

/**
 * Tracks every `.still-root` element a host created so appearance changes
 * (theme, accent, the host's light/dark switch) reach all of them at once.
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

/** Creates a portal scope in `doc.body` for dialogs and popovers. */
export function createPortal(doc: Document, ctx: Pick<MountContext, "scopes" | "scopeClassName">): HTMLElement {
  const portal = doc.createElement("div");
  portal.className = `still-root ${ctx.scopeClassName} still-portal`;
  doc.body.append(portal);
  ctx.scopes.add(portal);
  return portal;
}

/** Renders a Still view into a host element inside its own `.still-root` scope; returns the unmount. */
export function mountStill(container: Element, node: ReactNode, ctx: MountContext, { fill = true } = {}): () => void {
  const scope = container.ownerDocument.createElement("div");
  scope.className = `still-root ${ctx.scopeClassName}`;
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
      scopeClassName={ctx.scopeClassName}
      version={ctx.version}
      portalContainer={ctx.portalContainer}
      overrides={ctx.overrides}
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
