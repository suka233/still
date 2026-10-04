import { StillProvider, type StillHost, type StillStore } from "@still/ui";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

export interface MountContext {
  store: StillStore;
  host: StillHost;
  lang: string;
  portalContainer: HTMLElement;
}

/** Renders a Still view into a host element inside its own `.still-root` scope. */
export function mount(container: Element, node: ReactNode, ctx: MountContext): () => void {
  const scope = document.createElement("div");
  scope.className = "still-root still-siyuan";
  scope.style.height = "100%";
  container.append(scope);
  const root: Root = createRoot(scope);
  root.render(
    <StillProvider store={ctx.store} host={ctx.host} lang={ctx.lang} portalContainer={ctx.portalContainer}>
      {node}
    </StillProvider>,
  );
  return () => {
    root.unmount();
    scope.remove();
  };
}
